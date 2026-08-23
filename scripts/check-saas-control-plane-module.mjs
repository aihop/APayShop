
import { readFileSync, existsSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const requiredFiles = [
  'modules/saas-control-plane/module.ts',
  'modules/saas-control-plane/runtime/pages/admin.vue',
  'modules/saas-control-plane/runtime/server/api.ts',
  'modules/saas-control-plane/runtime/server/crypto.ts',
  'modules/saas-control-plane/runtime/server/storage.ts',
  'modules/saas-control-plane/runtime/server/providers/index.ts',
  'modules/saas-control-plane/runtime/server/providers/shoply.ts',
]

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing SaaS control-plane file: ${file}`)
}

const config = read('nuxt.config.ts')
const moduleEntry = read('modules/saas-control-plane/module.ts')
const api = read('modules/saas-control-plane/runtime/server/api.ts')
const crypto = read('modules/saas-control-plane/runtime/server/crypto.ts')
const shoply = read('modules/saas-control-plane/runtime/server/providers/shoply.ts')
const permissions = read('server/utils/adminPermissions.ts')

if (!config.includes("'./modules/saas-control-plane/module'")) {
  throw new Error('SaaS control-plane module is not registered in Nuxt')
}
if (!moduleEntry.includes("APAY_SAAS_CONTROL_PLANE_ENABLED === 'false'")) {
  throw new Error('SaaS control-plane module must remain build-time optional')
}
if (!moduleEntry.includes("route: '/admin/saas'") || !moduleEntry.includes("route: '/api/saas-control-plane/admin/**'")) {
  throw new Error('SaaS control-plane page or API route is not registered')
}
if (!permissions.includes('THEME_EXTENSION_PERMISSION_PATTERN = /^ext:')) {
  throw new Error('APay no longer accepts namespaced extension permissions')
}
if (!api.includes('SAAS_ADMIN_PERMISSION') || !api.includes('requireSaasAdmin(event)')) {
  throw new Error('SaaS module API must enforce its extension permission')
}
if (!api.includes("permissions.includes('settings:edit')") || !api.includes('Credential must be re-entered when the provider URL changes')) {
  throw new Error('SaaS connection mutations must protect stored credentials from URL swapping')
}
if (!api.includes('recordOperationFromEvent') || !read('modules/saas-control-plane/runtime/pages/admin.vue').includes("useRequestHeaders(['cookie'])")) {
  throw new Error('SaaS connection changes need audit records and SSR admin session forwarding')
}
if (!crypto.includes("'AES-GCM'") || !api.includes('encryptCredential') || !api.includes('decryptCredential')) {
  throw new Error('SaaS provider credentials must use authenticated encryption')
}
for (const path of ['dashboard/summary', 'store/list', 'plan/list', 'subscription/list']) {
  if (!shoply.includes(`'${path}'`)) throw new Error(`Shoply provider is missing fixed path ${path}`)
}
if (/request\([^)]*path/i.test(shoply) && !shoply.includes("path: string")) {
  throw new Error('Unexpected Shoply request shape')
}
if (existsSync('app/themes/minimal/theme.admin.json') && read('app/themes/minimal/theme.admin.json').includes('saas-control-plane')) {
  throw new Error('SaaS control plane must not be owned by the Minimal theme')
}

console.log('✓ SaaS control-plane module boundaries verified')
