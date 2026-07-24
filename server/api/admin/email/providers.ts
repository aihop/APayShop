import { emailProviders } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  if (event.method === 'POST') {
    const body = await readBody(event)

    // Upsert: one active provider at a time (deactivate all, then activate selected)
    if (body.isActive) {
      const all = await db.select().from(emailProviders)
      for (const p of all) {
        if (p.isActive) {
          await db.update(emailProviders).set({ isActive: false }).where(eq(emailProviders.id, p.id))
        }
      }
    }

    // Check if provider with this code already exists
    const existing = await db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.code, body.code))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(emailProviders)
        .set({
          name: body.name,
          isActive: body.isActive ?? false,
          configJson: body.configJson || '',
          sendScript: body.sendScript || '',
        })
        .where(eq(emailProviders.id, existing[0].id))
    } else {
      await db.insert(emailProviders).values({
        name: body.name,
        code: body.code,
        isActive: body.isActive ?? false,
        configJson: body.configJson || '',
        sendScript: body.sendScript || '',
      })
    }

    return { success: true }
  }

  if (event.method === 'GET') {
    return await db.select().from(emailProviders)
  }

  throw createError({ statusCode: 405, message: locale === 'zh' ? '请求方法不允许' : 'Method not allowed' })
})
