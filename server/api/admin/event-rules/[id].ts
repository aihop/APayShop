import { eventRules } from '../../../db/schema'
import { db } from '../../../db/runtime'
import { eq } from 'drizzle-orm'

// 事件自动化规则:更新 / 删除。
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }

  if (event.method === 'PUT') {
    const body = await readBody(event)
    const patch: Record<string, any> = { updatedAt: new Date() }
    if (body?.event !== undefined) patch.event = String(body.event).trim()
    if (body?.action !== undefined) patch.action = String(body.action).trim()
    if (body?.config !== undefined) patch.config = body.config
    if (body?.enabled !== undefined) patch.enabled = Boolean(body.enabled)
    if (body?.remark !== undefined) patch.remark = body.remark ? String(body.remark) : null
    await db.update(eventRules).set(patch).where(eq(eventRules.id, id))
    return { ok: true }
  }

  if (event.method === 'DELETE') {
    await db.delete(eventRules).where(eq(eventRules.id, id))
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})
