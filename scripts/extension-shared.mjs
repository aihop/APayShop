import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])
const MIGRATION_ID_PATTERN = /^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/
const MIGRATION_DIALECTS = ['sqlite', 'postgresql', 'mysql']

const assertSafeRelativePath = (value, label) => {
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
    throw new Error(`${label} must be a safe relative path`)
  }
  return value.split(path.sep).join('/')
}

const normalizeApiPath = (value, label) => {
  const normalized = assertSafeRelativePath(value, label).replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized.includes(':') || normalized.includes('*') || normalized.includes('[')) {
    throw new Error(`${label} must be a non-dynamic API path`)
  }
  return normalized
}

const readMigrationFile = (root, extensionId, migrationId, dialect, relativePath) => {
  const normalized = assertSafeRelativePath(relativePath, `${extensionId}: migration ${migrationId} ${dialect}`)
  if (!normalized.startsWith(`${dialect}/`) || !normalized.endsWith('.sql')) {
    throw new Error(`${extensionId}: migration ${migrationId} ${dialect} must be a .sql file under database/${dialect}`)
  }
  const absolutePath = path.join(root, 'database', normalized)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${extensionId}: missing ${dialect} migration ${normalized}`)
  }
  const sql = fs.readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n').trim()
  if (!sql) throw new Error(`${extensionId}: migration ${migrationId} ${dialect} is empty`)
  if (/\b(?:BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)) {
    throw new Error(`${extensionId}: migration ${migrationId} ${dialect} must not control transactions`)
  }
  if (/\bDROP\s+(?:TABLE|COLUMN|DATABASE|SCHEMA)\b/i.test(sql)) {
    throw new Error(`${extensionId}: migration ${migrationId} ${dialect} must be forward-only and cannot drop data`)
  }
  const tablePrefix = `ext_${extensionId.replaceAll('-', '_')}_`
  const writeTargets = [
    ...sql.matchAll(/\b(?:CREATE|ALTER)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-zA-Z0-9_]+)/gi),
    ...sql.matchAll(/\bINSERT\s+INTO\s+[`"]?([a-zA-Z0-9_]+)/gi),
    ...sql.matchAll(/\bUPDATE\s+[`"]?([a-zA-Z0-9_]+)/gi),
    ...sql.matchAll(/\bDELETE\s+FROM\s+[`"]?([a-zA-Z0-9_]+)/gi),
    ...sql.matchAll(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+[`"]?[a-zA-Z0-9_]+[`"]?\s+ON\s+[`"]?([a-zA-Z0-9_]+)/gi),
  ]
  for (const match of writeTargets) {
    if (!match[1].startsWith(tablePrefix)) {
      throw new Error(`${extensionId}: migration ${migrationId} ${dialect} table ${match[1]} must use prefix ${tablePrefix}`)
    }
  }
  const statements = sql.split('--> statement-breakpoint').map(statement => statement.trim()).filter(Boolean)
  return {
    file: normalized,
    checksum: createHash('sha256').update(sql).digest('hex'),
    statements,
  }
}

export const readExtensionManifests = (extensionsDir) => {
  if (!fs.existsSync(extensionsDir)) return []

  const manifests = fs.readdirSync(extensionsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const root = path.join(extensionsDir, entry.name)
      const manifestPath = path.join(root, 'extension.json')
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Extension ${entry.name} is missing extension.json`)
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (manifest.schemaVersion !== 1) throw new Error(`${entry.name}: schemaVersion must be 1`)
      if (!ID_PATTERN.test(manifest.id || '') || manifest.id !== entry.name) {
        throw new Error(`${entry.name}: id must match the directory and use kebab-case`)
      }
      for (const key of ['name', 'version', 'description']) {
        if (typeof manifest[key] !== 'string' || !manifest[key].trim()) {
          throw new Error(`${entry.name}: ${key} is required`)
        }
      }

      const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : []
      const capabilityKeys = new Set()
      capabilities.forEach((capability, index) => {
        if (!KEY_PATTERN.test(capability?.key || '')) {
          throw new Error(`${entry.name}: capabilities[${index}].key must use kebab-case`)
        }
        if (capabilityKeys.has(capability.key)) throw new Error(`${entry.name}: duplicate capability ${capability.key}`)
        if (typeof capability.label !== 'string' || typeof capability.labelZh !== 'string') {
          throw new Error(`${entry.name}: capability ${capability.key} requires label and labelZh`)
        }
        capabilityKeys.add(capability.key)
      })

      const validatePages = (pages, kind) => {
        const keys = new Set()
        return (Array.isArray(pages) ? pages : []).map((page, index) => {
          if (!KEY_PATTERN.test(page?.key || '')) throw new Error(`${entry.name}: ${kind}Pages[${index}].key is invalid`)
          if (keys.has(page.key)) throw new Error(`${entry.name}: duplicate ${kind} page ${page.key}`)
          keys.add(page.key)
          const component = assertSafeRelativePath(page.component, `${entry.name}: ${kind} page component`)
          const componentPath = path.join(root, kind, 'pages', component)
          if (!fs.existsSync(componentPath) || !component.endsWith('.vue')) {
            throw new Error(`${entry.name}: missing ${kind} page component ${component}`)
          }
          if (kind === 'admin' && !capabilityKeys.has(page.capability)) {
            throw new Error(`${entry.name}: admin page ${page.key} has unknown capability ${page.capability}`)
          }
          return { ...page, component }
        })
      }

      const validateApis = (apis, kind) => {
        const routes = new Set()
        return (Array.isArray(apis) ? apis : []).map((api, index) => {
          const method = String(api?.method || '').toLowerCase()
          if (!HTTP_METHODS.has(method)) throw new Error(`${entry.name}: ${kind}Apis[${index}].method is invalid`)
          const apiPath = normalizeApiPath(api.path, `${entry.name}: ${kind} API path`)
          const handler = assertSafeRelativePath(api.handler, `${entry.name}: ${kind} API handler`)
          const handlerPath = path.join(root, 'api', kind, handler)
          if (!fs.existsSync(handlerPath) || !handler.endsWith('.ts')) {
            throw new Error(`${entry.name}: missing ${kind} API handler ${handler}`)
          }
          if (kind === 'admin' && !capabilityKeys.has(api.capability)) {
            throw new Error(`${entry.name}: admin API ${method.toUpperCase()} ${apiPath} has unknown capability ${api.capability}`)
          }
          const routeKey = `${method}:${apiPath}`
          if (routes.has(routeKey)) throw new Error(`${entry.name}: duplicate ${kind} API ${routeKey}`)
          routes.add(routeKey)
          return { ...api, method, path: apiPath, handler }
        })
      }

      const validateDatabase = (database) => {
        const migrations = Array.isArray(database?.migrations) ? database.migrations : []
        const ids = new Set()
        let previousId = ''
        return {
          migrations: migrations.map((migration, index) => {
            const id = String(migration?.id || '')
            if (!MIGRATION_ID_PATTERN.test(id)) {
              throw new Error(`${entry.name}: database.migrations[${index}].id is invalid`)
            }
            if (ids.has(id)) throw new Error(`${entry.name}: duplicate migration ${id}`)
            if (previousId && id.localeCompare(previousId) <= 0) {
              throw new Error(`${entry.name}: migrations must be ordered by id`)
            }
            ids.add(id)
            previousId = id
            return {
              id,
              dialects: Object.fromEntries(MIGRATION_DIALECTS.map(dialect => [
                dialect,
                readMigrationFile(root, manifest.id, id, dialect, migration?.[dialect]),
              ])),
            }
          }),
        }
      }

      const database = validateDatabase(manifest.database)
      if (manifest.defaultEnabled === true && database.migrations.length > 0) {
        throw new Error(`${entry.name}: extensions with database migrations cannot be defaultEnabled`)
      }

      return {
        ...manifest,
        root,
        manifestPath,
        defaultEnabled: manifest.defaultEnabled === true,
        capabilities,
        adminPages: validatePages(manifest.adminPages, 'admin'),
        userPages: validatePages(manifest.userPages, 'user'),
        adminApis: validateApis(manifest.adminApis, 'admin'),
        userApis: validateApis(manifest.userApis, 'user'),
        database,
      }
    })

  const ids = new Set()
  for (const manifest of manifests) {
    if (ids.has(manifest.id)) throw new Error(`Duplicate extension id ${manifest.id}`)
    ids.add(manifest.id)
  }
  return manifests
}
