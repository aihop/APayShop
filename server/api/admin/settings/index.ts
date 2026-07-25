import { settings } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { setAuditMeta } from '../../../utils/auditLog'

export default defineEventHandler(async (event) => {
  
  if (event.method === "GET") {
    return await db.select().from(settings)
  }
  
  if (event.method === "POST") {
    const body = await readBody(event)
    const changes: Record<string, { before: string | null; after: string }> = {}

    // Upsert logic for each setting
    for (const [key, value] of Object.entries(body)) {
      const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1)

      if (existing.length) {
        await db.update(settings).set({ value: String(value) }).where(eq(settings.key, key))
      } else {
        await db.insert(settings).values({ key, value: String(value) })
      }

      // Only the settings that actually moved — the UI posts the whole form,
      // so recording the raw body would bury one real change under fifty
      // unchanged ones. Secret-looking keys are redacted downstream.
      const before = existing.length ? existing[0].value ?? null : null
      if (before !== String(value)) {
        changes[key] = { before, after: String(value) }
      }
    }

    setAuditMeta(event, {
      action: 'update',
      resource: 'settings',
      summary: `Updated ${Object.keys(changes).length} setting(s)`,
      details: { changed: changes },
    })

    return { success: true }
  }
})
