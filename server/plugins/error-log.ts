import { appendFileSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getRequestPath, getMethod, setResponseHeader } from 'h3'
import type { H3Event } from 'h3'

/**
 * API 错误留痕。
 *
 * 为什么需要单独一个插件：现有两条日志通道都覆盖不到 5xx。
 * - access-log.ts 挂在 `afterResponse` 上，而 Nitro 的错误处理器会自己写响应并置
 *   `event.handled`，h3 的 toNodeListener 因此提前返回，错误请求根本到不了那个 hook；
 *   实测 access_logs 里 5xx 记录为零。
 * - audit-log.ts 确实 hook 了 `error`，但只记录 admin API 前缀下的写操作，
 *   /api/qingpu/* 一条都不进。
 *
 * 结果是 2026-08-28 连续排查三个 ReferenceError 时，没有任何可对照的服务端记录，
 * 只能靠读提交和跑类型检查倒推。dev 响应体里虽然带 message 和 stack，但那是一次性的，
 * 请求关掉就没了。
 *
 * 这里补上最小可用的一层：requestId 贯穿请求与响应头，错误落一条 jsonl，
 * 既打 stdout 也写文件，可以直接 tail 或按 requestId 检索。
 */

/** 本地运行时数据目录（.gitignore 里的 .data），不入仓 */
const LOG_PATH = join(process.cwd(), '.data', 'logs', 'api-errors.jsonl')

/** 超过这个大小就截断保留后半，避免日志无限增长吃满磁盘 */
const MAX_LOG_BYTES = 5 * 1024 * 1024

/** 噪音路径：静态资源、devtools、HMR，记了只会淹没真正的错误 */
const SKIPPED_PREFIXES = [
  '/_nuxt/',
  '/__nuxt_devtools',
  '/_ipx/',
  '/favicon',
  '/robots.txt',
  '/@vite/',
  '/@id/',
]

const shouldSkip = (path: string) => SKIPPED_PREFIXES.some(prefix => path.startsWith(prefix))

/** 只取能安全落盘的标识，绝不记录请求体/响应体，避免把凭证写进日志 */
const resolveUserId = (event: H3Event): string | number | null => {
  const context = event.context as Record<string, any>
  return context?.userId
    ?? context?.admin?.id
    ?? context?.auth?.userId
    ?? null
}

const rotateIfNeeded = () => {
  try {
    const { size } = statSync(LOG_PATH)
    if (size <= MAX_LOG_BYTES) return
    // 保留后半：最近的错误比最早的有用
    const content = readFileSync(LOG_PATH, 'utf8')
    const kept = content.slice(Math.floor(content.length / 2))
    writeFileSync(LOG_PATH, kept.slice(kept.indexOf('\n') + 1))
  }
  catch {
    // 文件不存在或读不动都不该影响写入，交给下面的 appendFileSync
  }
}

const writeRecord = (record: Record<string, unknown>) => {
  const line = JSON.stringify(record)
  // stdout 一份：dev 下直接在终端可见
  console.error(`[api-error] ${line}`)
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true })
    rotateIfNeeded()
    appendFileSync(LOG_PATH, `${line}\n`)
  }
  catch (error) {
    // 记录失败绝不能影响请求本身，降级到控制台就够了
    console.error('[api-error] 写日志失败：', error instanceof Error ? error.message : String(error))
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const requestId = randomUUID().slice(0, 8)
    ;(event.context as Record<string, any>).requestId = requestId
    try {
      // 回传给前端：用户截图或粘贴响应头就能对上服务端这条记录
      setResponseHeader(event, 'x-request-id', requestId)
    }
    catch {
      // 响应已开始写出时设置头会抛，忽略即可——记录仍然带 requestId
    }
  })

  nitroApp.hooks.hook('error', (error: any, context: any) => {
    const event = context?.event as H3Event | undefined
    if (!event) return

    const path = getRequestPath(event)
    if (shouldSkip(path)) return

    const statusCode = Number(error?.statusCode || error?.status || 500)

    writeRecord({
      at: new Date().toISOString(),
      requestId: (event.context as Record<string, any>)?.requestId || null,
      method: (getMethod(event) || 'GET').toUpperCase(),
      path,
      statusCode,
      userId: resolveUserId(event),
      name: error?.name || null,
      message: error?.message || String(error),
      // 栈只落盘，不进响应体——生产环境的响应仍由 Nitro 按环境决定
      stack: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 30) : null,
      cause: error?.cause ? String(error.cause) : null,
    })
  })
})
