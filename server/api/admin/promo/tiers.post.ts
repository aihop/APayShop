import { eq } from 'drizzle-orm'
import { promoAgentTiers } from '../../../db/schema'
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const id = Number(body?.id || 0)

  const payload = {
    code: String(body?.code || '').trim(),
    name: String(body?.name || '').trim(),
    roleScope: String(body?.roleScope || 'agent').trim(),
    level: Number(body?.level || 1),
    discountRate: Number(body?.discountRate || 1),
    salesThreshold: Number(body?.salesThreshold || 0),
    isFixed: body?.isFixed === true,
    isActive: body?.isActive !== false,
    description: body?.description ? String(body.description) : null,
    updatedAt: new Date(),
  }

  if (!payload.code || !payload.name) {
    throw createError({ statusCode: 400, statusMessage: 'code 和 name 必填' })
  }

  if (id > 0) {
    await db.update(promoAgentTiers).set(payload).where(eq(promoAgentTiers.id, id))
    return { ok: true, id }
  }

  const inserted = await db.insert(promoAgentTiers).values({
    ...payload,
    createdAt: new Date(),
  }).returning()

  return inserted[0] || inserted
})
