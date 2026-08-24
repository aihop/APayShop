#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readExtensionManifests } from './extension-shared.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const registryPath = path.join(root, 'server/utils/extensionRegistry.generated.ts')
const clientRegistryPath = path.join(root, 'app/extensions/extensionDatabase.generated.ts')
const before = read('server/utils/extensionRegistry.generated.ts')
const clientBefore = read('app/extensions/extensionDatabase.generated.ts')

execFileSync(process.execPath, ['scripts/generate-extension-build.mjs'], { cwd: root, stdio: 'pipe' })
const after = read('server/utils/extensionRegistry.generated.ts')
const clientAfter = read('app/extensions/extensionDatabase.generated.ts')
assert.equal(after, before, 'generated extension registry is stale; run node scripts/generate-extension-build.mjs')
assert.equal(clientAfter, clientBefore, 'generated client extension database registry is stale; run node scripts/generate-extension-build.mjs')

const manifests = readExtensionManifests(path.join(root, 'app/extensions'))
assert.ok(manifests.length > 0, 'at least one reference extension is required')

const auth = read('server/middleware/auth.ts')
const permissions = read('server/utils/adminPermissions.ts')
const runtime = read('server/utils/extensions.ts')
const adminHost = read('server/api/admin/plugins/[extension]/[...slug].ts')
const userHost = read('server/api/plugins/[extension]/[...slug].ts')
const userMiddleware = read('app/middleware/extension-user-auth.global.ts')

assert.ok(auth.includes('matchPermissionForApiPath(pathname, event.method)'), 'admin auth must include the HTTP method')
assert.ok(permissions.includes('extensionAdminApiRoutes.find'), 'admin permissions must resolve manifest API routes')
assert.ok(permissions.includes('isPluginPermissionCode'), 'plugin permission codes must survive normalization')
assert.ok(runtime.includes('requireEnabledExtension(extension)'), 'API dispatch must enforce extension enablement')
assert.ok(runtime.includes('requireExtensionDatabaseReady(extension)'), 'API dispatch must enforce extension database readiness')
assert.ok(runtime.includes('const isInstalledExtension = (extension: string) => extensionManifests.some'), 'installed extension checks must read manifests lazily')
assert.ok(!runtime.includes('new Set(extensionManifests.map'), 'extension manifests must not be read during module initialization')
assert.ok(runtime.includes('checksum_mismatch'), 'applied migration checksum changes must be rejected')
assert.ok(runtime.includes('extension_migration_lock:'), 'extension migrations must use a database lock')
assert.ok(adminHost.includes("dispatchExtensionApi(event, 'admin')"), 'admin catch-all host is missing')
assert.ok(userHost.includes("dispatchExtensionApi(event, 'user')"), 'user catch-all host is missing')
assert.ok(userMiddleware.includes("path.startsWith('/user/plugins/')"), 'plugin user pages must have an independent login guard')

for (const manifest of manifests) {
  for (const api of manifest.userApis) {
    const handler = read(path.relative(root, path.join(manifest.root, 'api/user', api.handler)))
    assert.ok(handler.includes('requireUserSession(event)'), `${manifest.id} user API ${api.path} must require a user session`)
  }
  for (const api of manifest.adminApis) {
    assert.ok(api.capability, `${manifest.id} admin API ${api.path} must declare a capability`)
  }
  for (const migration of manifest.database.migrations) {
    for (const dialect of ['sqlite', 'postgresql', 'mysql']) {
      assert.equal(migration.dialects[dialect].checksum.length, 64, `${manifest.id} ${migration.id} ${dialect} checksum is invalid`)
      assert.ok(migration.dialects[dialect].statements.length > 0, `${manifest.id} ${migration.id} ${dialect} has no statements`)
    }
  }
}

for (const schema of ['server/db/schema.sqlite.ts', 'server/db/schema.pg.ts', 'server/db/schema.mysql.ts']) {
  assert.ok(!read(schema).includes('extensionRegistry'), `${schema} must not own extension-private schema`)
}

assert.ok(fs.existsSync(registryPath), 'generated registry must be committed')
assert.ok(fs.existsSync(clientRegistryPath), 'generated client database registry must be committed')

const example = manifests.find(manifest => manifest.id === 'example-tools')
assert.ok(example?.database.migrations.length, 'reference extension must include a private migration')
const shared = read('scripts/extension-shared.mjs')
for (const guard of ['INSERT\\s+INTO', 'UPDATE\\s+', 'DELETE\\s+FROM', 'CREATE\\s+(?:UNIQUE']) {
  assert.ok(shared.includes(guard), `migration private-table guard is missing ${guard}`)
}
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'apay-extension-migration-'))
const databasePath = path.join(temporaryDirectory, 'extension.db')
try {
  const statements = example.database.migrations.flatMap(migration => migration.dialects.sqlite.statements)
  const sql = `${statements.join('\n')}\n${statements.join('\n')}`
  execFileSync('sqlite3', [databasePath], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] })
  const tables = execFileSync('sqlite3', [databasePath, "select name from sqlite_master where type='table' and name='ext_example_tools_records';"], { encoding: 'utf8' }).trim()
  assert.equal(tables, 'ext_example_tools_records', 'reference extension SQLite migration did not create its private table')
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}

console.log(`✓ extension system guard passed (${manifests.length} extension(s))`)
