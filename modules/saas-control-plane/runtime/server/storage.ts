
import { db } from '~~/server/db/runtime'
import { settings } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'
import { SAAS_CONNECTIONS_SETTING_KEY, type PublicSaasConnection, type StoredSaasConnection } from './types'

export const listConnections = async (): Promise<StoredSaasConnection[]> => {
  const rows = await db.select().from(settings).where(eq(settings.key, SAAS_CONNECTIONS_SETTING_KEY)).limit(1)
  if (!rows.length) return []
  try {
    const parsed = JSON.parse(rows[0]!.value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Stored SaaS connection configuration is invalid' })
  }
}

export const saveConnections = async (connections: StoredSaasConnection[]) => {
  const value = JSON.stringify(connections)
  const existing = await db.select().from(settings).where(eq(settings.key, SAAS_CONNECTIONS_SETTING_KEY)).limit(1)
  if (existing.length) {
    await db.update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, SAAS_CONNECTIONS_SETTING_KEY))
    return
  }
  await db.insert(settings).values({
    key: SAAS_CONNECTIONS_SETTING_KEY,
    value,
    description: 'Encrypted SaaS control-plane provider connections',
  })
}

export const toPublicConnection = (connection: StoredSaasConnection): PublicSaasConnection => ({
  id: connection.id,
  name: connection.name,
  provider: connection.provider,
  baseUrl: connection.baseUrl,
  secretPreview: connection.secretPreview,
  secretConfigured: Boolean(connection.secret),
  enabled: connection.enabled,
  isDefault: connection.isDefault,
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt,
})
