import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 游客代理白名单守卫。
 *
 * 背景:proxyExternalRequest 支持 target=(完整 URL) 与 path=(相对路径) 两种传参。
 * path= 分支原先只校验目标 host 等于 AI 网关,从不调用 assertTargetAllowed,
 * 于是调用方声明的 allowedPaths 在该分支完全失效。而免登录端点
 * /api/minimal/public-external 恰恰只走 path= 分支(useExternalApi 无 baseURL 时
 * 一律发 path=),它那份公开路径白名单从未生效过——未认证请求就能借服务端的
 * integration_token 访问网关上任意非 admin 接口。
 *
 * 本守卫钉两件事:
 *   1. path= 分支必须调用 assertTargetAllowed(别再被绕过);
 *   2. 免登录端点的白名单必须覆盖全部真实调用方路径(别修完把登录打挂)。
 */

const repoRoot = new URL('..', import.meta.url)
const read = (relativePath) => readFileSync(new URL(relativePath, repoRoot), 'utf8')

const failures = []

// —— 1. path= 分支必须走 assertTargetAllowed ——
const proxySource = read('server/utils/externalProxy.ts')
const pathBranchAt = proxySource.indexOf('if (rawPath)')
const targetBranchAt = proxySource.indexOf('} else if (rawTarget)')

if (pathBranchAt < 0 || targetBranchAt < 0 || pathBranchAt > targetBranchAt) {
  failures.push('externalProxy.ts 的 path=/target= 分支结构已变,守卫无法定位——请同步更新本守卫')
} else {
  const pathBranch = proxySource.slice(pathBranchAt, targetBranchAt)
  if (!pathBranch.includes('assertTargetAllowed(')) {
    failures.push(
      'externalProxy.ts 的 path= 分支没有调用 assertTargetAllowed:\n'
      + '     调用方声明的 allowedPaths 会静默失效,免登录端点等于对网关全量开放',
    )
  }
}

// —— 2. 免登录端点的白名单必须覆盖真实调用方 ——
const PUBLIC_PROXY_ENDPOINT = '/api/minimal/public-external'
const handlerSource = read('app/themes/minimal/api/public-external.ts')

if (!handlerSource.includes('requireSession: false')) {
  // 端点如果哪天改成必须登录,本守卫的前提(免登录)就不再成立,提醒人来看一眼
  failures.push('public-external.ts 不再是免登录端点,请确认本守卫的假设是否仍然成立')
}
if (!handlerSource.includes('allowedPaths:')) {
  failures.push('public-external.ts 没有声明 allowedPaths,免登录端点必须带路径白名单')
}

const allowlist = new Set(
  [...handlerSource.matchAll(/^\s*'([^']+)',\s*$/gm)].map((match) => match[1]),
)

/** 递归收集 minimal 主题下的前端源码 */
const collectSourceFiles = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectSourceFiles(full, acc)
    else if (/\.(vue|ts)$/.test(entry)) acc.push(full)
  }
  return acc
}

const themeDir = new URL('app/themes/minimal/', repoRoot).pathname
const callers = collectSourceFiles(themeDir).filter((file) => (
  readFileSync(file, 'utf8').includes(PUBLIC_PROXY_ENDPOINT)
  && !file.endsWith('api/public-external.ts')
))

if (callers.length === 0) {
  failures.push(`没有找到 ${PUBLIC_PROXY_ENDPOINT} 的调用方,守卫的覆盖检查会形同虚设——请确认调用方是否已迁移`)
}

for (const file of callers) {
  const source = readFileSync(file, 'utf8')
  // 只认 get/post/put/delete("/...") 这类直接字面量调用;变量拼接的路径守卫看不到,
  // 但这类调用在本链路上不存在(见下方 dynamicCall 检查)
  const requested = [...source.matchAll(/\b(?:get|post|put|delete)\s*<[^>]*>?\s*\(\s*['"](\/[^'"]+)['"]/g)]
    .map((match) => match[1])
  const shortName = file.slice(themeDir.length)

  for (const path of requested) {
    if (!allowlist.has(path)) {
      failures.push(
        `${shortName} 通过免登录代理请求 ${path},但它不在 PUBLIC_EXTERNAL_PROXY_PATHS 里\n`
        + '     → 该请求会被 403;确认这条路径确实对游客公开后再加进白名单',
      )
    }
  }
}

if (failures.length > 0) {
  console.error('❌ 游客代理白名单检查未通过:\n')
  for (const failure of failures) console.error(`   - ${failure}`)
  console.error('\n   免登录 + 服务端 integration_token 是高危组合,安全边界全靠这份白名单。')
  process.exit(1)
}

console.log(`✓ 游客代理白名单检查通过(白名单 ${allowlist.size} 条,调用方 ${callers.length} 个)`)
