import { and, eq, lt, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { settings } from '../db/schema'
import { db } from '../db/runtime'
import {
  extensionAdminApiRoutes,
  extensionDatabaseMigrations,
  extensionManifests,
  extensionUserApiRoutes,
  type ExtensionDatabaseDialect,
} from './extensionRegistry.generated'

export const ENABLED_EXTENSIONS_SETTING_KEY = 'enabled_extensions'
const EXTENSION_MIGRATION_LOCK_TTL_MS = 5 * 60 * 1000
const migrationLedgerKey = (extension: string, migration: string) => `extension_migration:${extension}:${migration}`
const migrationFailureKey = (extension: string) => `extension_migration_failure:${extension}`
const migrationLockKey = (extension: string) => `extension_migration_lock:${extension}`
const migrationReadyKey = (extension: string) => `extension_migrations:${extension}`

const isInstalledExtension = (extension: string) => extensionManifests.some(manifest => manifest.id === extension)

export const resolveExtensionDatabaseDialect = (): ExtensionDatabaseDialect => {
  const explicit = String(process.env.DB_DIALECT || '').replace(/"/g, '').trim().toLowerCase()
  if (explicit === 'postgresql' || explicit === 'mysql' || explicit === 'sqlite') return explicit
  const connectionUrl = String(
    process.env.DATABASE_URL
    || process.env.MYSQL_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRESQL_URL
    || process.env.NUXT_DATABASE_URL
    || process.env.LIBSQL_URL
    || '',
  ).replace(/"/g, '').trim().toLowerCase()
  if (connectionUrl.startsWith('postgres://') || connectionUrl.startsWith('postgresql://')) return 'postgresql'
  if (connectionUrl.startsWith('mysql://')) return 'mysql'
  return 'sqlite'
}

const extensionMigrations = (extension: string) => extensionDatabaseMigrations.filter(
  migration => migration.extension === extension,
)

const writeSetting = async (key: string, value: string, description: string) => {
  const existing = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, key)).limit(1)
  if (existing.length) {
    await db.update(settings).set({ value, description, updatedAt: new Date() }).where(eq(settings.key, key))
  } else {
    await db.insert(settings).values({ key, value, description })
  }
}

export const readExtensionMigrationStatus = async (extension: string) => {
  if (!isInstalledExtension(extension)) {
    throw createError({ statusCode: 404, message: 'Extension not found' })
  }
  const dialect = resolveExtensionDatabaseDialect()
  const migrations = extensionMigrations(extension)
  const rows = await db.select({ key: settings.key, value: settings.value }).from(settings)
  const values = new Map<string, string>(rows.map(
    (row: { key: string, value: string }) => [row.key, row.value] as const,
  ))
  const items = migrations.map((migration) => {
    const expectedChecksum = migration.dialects[dialect].checksum
    const appliedChecksum = values.get(migrationLedgerKey(extension, migration.id)) || null
    return {
      id: migration.id,
      checksum: expectedChecksum,
      state: appliedChecksum === expectedChecksum ? 'applied' : appliedChecksum ? 'checksum_mismatch' : 'pending',
    }
  })
  const failed = values.get(migrationFailureKey(extension))
  let failure: { migrationId: string, failedAt: string } | null = null
  try {
    failure = failed ? JSON.parse(failed) as { migrationId: string, failedAt: string } : null
  } catch {
    failure = null
  }
  return {
    dialect,
    state: items.some(item => item.state === 'checksum_mismatch')
      ? 'checksum_mismatch'
      : items.every(item => item.state === 'applied')
        ? 'ready'
        : failed ? 'failed' : 'pending',
    migrations: items,
    failure,
  }
}

export const requireExtensionDatabaseReady = async (extension: string) => {
  const status = await readExtensionMigrationStatus(extension)
  if (status.state !== 'ready') {
    throw createError({ statusCode: 409, message: `Extension database is ${status.state}` })
  }
}

const acquireExtensionMigrationLock = async (extension: string) => {
  const key = migrationLockKey(extension)
  await db.delete(settings).where(and(
    eq(settings.key, key),
    lt(settings.updatedAt, new Date(Date.now() - EXTENSION_MIGRATION_LOCK_TTL_MS)),
  ))
  const token = globalThis.crypto.randomUUID()
  try {
    await db.insert(settings).values({ key, value: token, description: 'Temporary extension migration lock' })
  } catch (error) {
    const existing = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, key)).limit(1)
    if (existing.length) {
      throw createError({ statusCode: 409, message: 'Extension migration is already running' })
    }
    throw error
  }
  return async () => {
    await db.delete(settings).where(and(eq(settings.key, key), eq(settings.value, token)))
  }
}

const executeMigrationStatements = async (dialect: ExtensionDatabaseDialect, statements: string[]) => {
  if (dialect === 'postgresql') {
    await db.transaction(async (transaction: { execute: (query: unknown) => Promise<unknown> }) => {
      for (const statement of statements) await transaction.execute(sql.raw(statement))
    })
    return
  }
  for (const statement of statements) {
    if (dialect === 'mysql') await db.execute(sql.raw(statement))
    else await db.run(sql.raw(statement))
  }
}

export const migrateExtensionDatabase = async (extension: string) => {
  if (!isInstalledExtension(extension)) {
    throw createError({ statusCode: 404, message: 'Extension not found' })
  }
  const release = await acquireExtensionMigrationLock(extension)
  try {
    const before = await readExtensionMigrationStatus(extension)
    if (before.state === 'checksum_mismatch') {
      throw createError({ statusCode: 409, message: 'An applied extension migration checksum changed' })
    }
    const dialect = before.dialect
    const applied: string[] = []
    for (const migration of extensionMigrations(extension)) {
      const current = before.migrations.find(item => item.id === migration.id)
      if (current?.state === 'applied') continue
      try {
        await executeMigrationStatements(dialect, migration.dialects[dialect].statements)
        await writeSetting(
          migrationLedgerKey(extension, migration.id),
          migration.dialects[dialect].checksum,
          `Applied ${dialect} migration for extension ${extension}`,
        )
        applied.push(migration.id)
      } catch (error) {
        console.error(`[extensions] migration failed: ${extension}/${migration.id}/${dialect}`, error)
        await writeSetting(
          migrationFailureKey(extension),
          JSON.stringify({ migrationId: migration.id, failedAt: new Date().toISOString() }),
          `Last failed migration for extension ${extension}`,
        )
        throw createError({ statusCode: 500, message: `Extension migration ${migration.id} failed` })
      }
    }
    await db.delete(settings).where(eq(settings.key, migrationFailureKey(extension)))
    const status = await readExtensionMigrationStatus(extension)
    await writeSetting(
      migrationReadyKey(extension),
      JSON.stringify({
        dialect: status.dialect,
        checksums: Object.fromEntries(status.migrations.filter(item => item.state === 'applied').map(item => [item.id, item.checksum])),
      }),
      `Applied migration checksums for extension ${extension}`,
    )
    return { applied, status }
  } finally {
    await release().catch(error => console.error(`[extensions] failed to release migration lock: ${extension}`, error))
  }
}

export const normalizeEnabledExtensionIds = (input: unknown) => {
  if (!Array.isArray(input)) return []
  return [...new Set(input.filter(
    (value): value is string => typeof value === 'string' && isInstalledExtension(value),
  ))].sort()
}

export const readEnabledExtensionIds = async () => {
  const rows = await db.select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, ENABLED_EXTENSIONS_SETTING_KEY))
    .limit(1)
  if (!rows.length) {
    return extensionManifests.filter(
      manifest => manifest.defaultEnabled
        && !(manifest.database.migrations as readonly unknown[]).length,
    ).map(manifest => manifest.id)
  }
  try {
    return normalizeEnabledExtensionIds(JSON.parse(rows[0].value))
  } catch {
    return []
  }
}

export const requireEnabledExtension = async (extension: string) => {
  if (!isInstalledExtension(extension)) {
    throw createError({ statusCode: 404, message: 'Extension not found' })
  }
  const enabled = await readEnabledExtensionIds()
  if (!enabled.includes(extension)) {
    throw createError({ statusCode: 404, message: 'Extension is disabled' })
  }
  await requireExtensionDatabaseReady(extension)
}

const normalizedSlug = (event: H3Event) => {
  const value = getRouterParam(event, 'slug') || ''
  return value.replace(/^\/+|\/+$/g, '')
}

export const resolveExtensionApiRoute = (event: H3Event, kind: 'admin' | 'user') => {
  const extension = getRouterParam(event, 'extension') || ''
  const method = String(event.method || 'GET').toUpperCase()
  const apiPath = normalizedSlug(event)
  const routes = kind === 'admin' ? extensionAdminApiRoutes : extensionUserApiRoutes
  return routes.find(route => route.extension === extension && route.method === method && route.path === apiPath) || null
}

export const dispatchExtensionApi = async (event: H3Event, kind: 'admin' | 'user') => {
  const extension = getRouterParam(event, 'extension') || ''
  await requireEnabledExtension(extension)
  const route = resolveExtensionApiRoute(event, kind)
  if (!route) throw createError({ statusCode: 404, message: 'Extension API route not found' })
  return route.handler(event)
}
