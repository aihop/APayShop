import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
const methodAt = source.indexOf('const methodMatch = route.match')
const indexAt = source.indexOf("if (route.endsWith('/index'))")

if (methodAt < 0 || indexAt < 0 || methodAt > indexAt) {
  throw new Error('theme API routes must strip method suffixes before folding /index')
}

const normalize = (file) => {
  let route = file.replace(/\.ts$/, '')
  let method
  const methodMatch = route.match(/\.(get|post|put|patch|delete|head|options)$/)
  if (methodMatch) {
    method = methodMatch[1]
    route = route.slice(0, -methodMatch[0].length)
  }
  if (route.endsWith('/index')) route = route.slice(0, -'/index'.length)
  return { route, method }
}

const cases = [
  ['/admin/channel-prompts/index.get.ts', { route: '/admin/channel-prompts', method: 'get' }],
  ['/admin/channel-prompts/index.ts', { route: '/admin/channel-prompts', method: undefined }],
  ['/admin/channel-prompts/draft.post.ts', { route: '/admin/channel-prompts/draft', method: 'post' }],
]

for (const [file, expected] of cases) {
  const actual = normalize(file)
  if (actual.route !== expected.route || actual.method !== expected.method) {
    throw new Error(`${file} normalized to ${JSON.stringify(actual)}`)
  }
}

console.log('✓ 主题 API index/method 路由归一化检查通过')
