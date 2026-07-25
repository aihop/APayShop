import { settings } from "../db/schema"
import { db } from '../db/runtime'

// This endpoint is unauthenticated — the public storefront reads it directly
// for branding/locale/contact info. The `settings` table also doubles as
// storage for server-side secrets (outbound auth tokens, provider API keys,
// webhook signing secrets), which must never round-trip through here.
const SECRET_KEYS = new Set([
  'integration_token',
  'ai_api_key',
  'webhook_secret',
  'email_provider_config_json',
  'email_provider_send_script',
])

export default defineEventHandler(async (event) => {
  const rows = await db.select().from(settings)
  return rows.filter((row: { key: string }) => !SECRET_KEYS.has(row.key))
})
