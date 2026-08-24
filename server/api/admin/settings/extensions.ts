import { eq } from 'drizzle-orm'
import { settings } from '../../../db/schema'
import { db } from '../../../db/runtime'
import { setAuditMeta } from '../../../utils/auditLog'
import {
  ENABLED_EXTENSIONS_SETTING_KEY,
  normalizeEnabledExtensionIds,
  readEnabledExtensionIds,
  readExtensionMigrationStatus,
  migrateExtensionDatabase,
} from '../../../utils/extensions'
import { extensionManifests } from '../../../utils/extensionRegistry.generated'

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') {
    const migrationStatuses = await Promise.all(extensionManifests.map(async manifest => [
      manifest.id,
      await readExtensionMigrationStatus(manifest.id),
    ] as const))
    return {
      extensions: extensionManifests,
      enabled: await readEnabledExtensionIds(),
      migrationStatuses: Object.fromEntries(migrationStatuses),
    }
  }

  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }

  const body = await readBody(event)
  if (body?.action === 'migrate') {
    if (typeof body.extension !== 'string') {
      throw createError({ statusCode: 400, message: 'extension is required' })
    }
    try {
      const result = await migrateExtensionDatabase(body.extension)
      setAuditMeta(event, {
        action: 'update',
        resource: 'extensions',
        resourceId: body.extension,
        summary: `Applied ${result.applied.length} extension migration(s)`,
        details: { extension: body.extension, applied: result.applied, dialect: result.status.dialect },
      })
      return { success: true, ...result }
    } catch (error) {
      setAuditMeta(event, {
        action: 'update',
        resource: 'extensions',
        resourceId: body.extension,
        summary: 'Extension migration failed',
        details: { extension: body.extension },
      })
      throw error
    }
  }
  if (!Array.isArray(body?.enabled)) {
    throw createError({ statusCode: 400, message: 'enabled must be an array' })
  }
  const unknown = body.enabled.filter((value: unknown) =>
    typeof value !== 'string' || !extensionManifests.some(manifest => manifest.id === value),
  )
  if (unknown.length) {
    throw createError({ statusCode: 400, message: 'enabled contains an unknown extension' })
  }

  const before = await readEnabledExtensionIds()
  const enabled = normalizeEnabledExtensionIds(body.enabled)
  const migrationStatuses = await Promise.all(enabled.map(async extension => ({
    extension,
    status: await readExtensionMigrationStatus(extension),
  })))
  const unavailable = migrationStatuses.filter(item => item.status.state !== 'ready')
  if (unavailable.length) {
    throw createError({
      statusCode: 409,
      message: `Run migrations before enabling: ${unavailable.map(item => item.extension).join(', ')}`,
    })
  }
  const value = JSON.stringify(enabled)
  const existing = await db.select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, ENABLED_EXTENSIONS_SETTING_KEY))
    .limit(1)

  if (existing.length) {
    await db.update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, ENABLED_EXTENSIONS_SETTING_KEY))
  } else {
    await db.insert(settings).values({
      key: ENABLED_EXTENSIONS_SETTING_KEY,
      value,
      description: 'Enabled built-in APay extensions',
    })
  }

  setAuditMeta(event, {
    action: 'update',
    resource: 'extensions',
    summary: `Enabled ${enabled.length} extension(s)`,
    details: { before, after: enabled },
  })

  return { success: true, enabled }
})
