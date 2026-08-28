#!/usr/bin/env node
/**
 * API 错误留痕自检。
 *
 * 守的是「5xx 有没有服务端证据」这件事。此前两条日志通道都覆盖不到：
 * access-log.ts 挂 afterResponse，错误请求因 event.handled 到不了；
 * audit-log.ts 只记 admin API 的写操作。实测 access_logs 里 5xx 为零，
 * 于是排查只能靠肉眼盯终端——2026-08-28 连查三个 ReferenceError 都是这么倒推的。
 *
 * 这里断言错误插件的关键性质还在，而不是断言它长什么样：只要换了写法但仍然
 * hook error、仍然记录 requestId 与 stack、仍然不把请求体写进日志，就算通过。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const pluginsDir = join(repoRoot, 'server', 'plugins')

const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }

/** 按行为定位插件，不写死文件名——换名字不该让守卫失效 */
const findErrorPlugin = () => {
  if (!existsSync(pluginsDir)) return null
  const { readdirSync } = require('node:fs')
  for (const name of readdirSync(pluginsDir)) {
    if (!name.endsWith('.ts')) continue
    const source = readFileSync(join(pluginsDir, name), 'utf8')
    // 记录型错误插件的判据：hook 了 error 且把记录落盘
    if (/hooks\.hook\(\s*['"]error['"]/.test(source) && /appendFileSync|createWriteStream|writeFileSync/.test(source)) {
      return { name, source }
    }
  }
  return null
}

const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)

const plugin = findErrorPlugin()

if (!plugin) {
  console.error('❌ 找不到会落盘的错误记录插件')
  console.error('   server/plugins 下需要有一个 nitro plugin：hook \'error\' 并把记录写入文件。')
  console.error('   缺了它，5xx 在服务端不留任何痕迹——access-log 挂 afterResponse 收不到错误，')
  console.error('   audit-log 只记 admin API 写操作。')
  process.exit(1)
}

const { name, source } = plugin

check(/defineNitroPlugin\(/.test(source), `${name}: 不是 nitro plugin（缺 defineNitroPlugin）`)
check(/hooks\.hook\(\s*['"]request['"]/.test(source), `${name}: 没有 hook 'request'，无法为请求生成 requestId`)
check(/requestId/.test(source), `${name}: 记录里没有 requestId，用户报错时无法与日志对应`)
check(/x-request-id/i.test(source), `${name}: 没有把 requestId 写进响应头，前端拿不到`)

for (const field of ['statusCode', 'path', 'stack', 'message']) {
  check(new RegExp(field).test(source), `${name}: 错误记录缺少 ${field}`)
}

// 写日志失败不能影响请求本身
const writeGuarded = /catch\s*(\([^)]*\))?\s*\{[\s\S]{0,400}?console\.error/.test(source)
check(writeGuarded, `${name}: 写日志路径没有 catch 兜底，记录失败会冒泡影响请求`)

// 日志不得无限增长：光有个叫 rotate 的函数不算数，要有真正的大小阈值 + 重写动作。
// （第一版判据是 /MAX_LOG_BYTES|rotate|truncat/，把常量删掉后函数名里的 rotate
//   仍然匹配——那是条永远绿的护栏，等于没有。）
const hasSizeLimit = /\d+\s*\*\s*1024\s*\*\s*1024|\d{6,}/.test(source)
const hasTruncateAction = /writeFileSync|ftruncate|truncateSync|rm(Sync)?\(/.test(source)
check(
  hasSizeLimit && hasTruncateAction,
  `${name}: 没有可执行的滚动策略（需要大小阈值 + 截断/重写动作），日志会无限增长`,
)

// 绝不把请求体写进日志：那是凭证与密钥泄漏的常见来源
check(!/readBody|readRawBody/.test(source), `${name}: 读取了请求体，日志有泄漏凭证的风险`)

// 日志落在被 gitignore 的目录，别污染工作树
const logPathMatch = source.match(/join\(\s*process\.cwd\(\)\s*,\s*'([^']+)'/)
if (logPathMatch) {
  const topDir = logPathMatch[1]
  const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
  const ignored = gitignore.split('\n').some(line => line.trim().replace(/\/$/, '') === topDir.replace(/\/$/, ''))
  check(ignored, `${name}: 日志目录 ${topDir} 不在 .gitignore 里，会污染 git status`)
}

if (failures.length > 0) {
  console.error(`❌ 错误留痕自检未通过（${relative(repoRoot, join(pluginsDir, name))}）：`)
  for (const failure of failures) console.error(`   - ${failure}`)
  process.exit(1)
}

console.log(`✓ 错误留痕自检通过（${name}）`)
