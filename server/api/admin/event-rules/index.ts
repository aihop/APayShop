import { eventRules } from '../../../db/schema'
import { db } from '../../../db/runtime'
import { desc } from 'drizzle-orm'

// 事件自动化规则:列表 / 新建。(/api/admin 由 server/middleware/auth.ts 守鉴权)
export default defineEventHandler(async (event) => {
  if (event.method === 'GET') {
    return await db.select().from(eventRules).orderBy(desc(eventRules.id))
  }

  if (event.method === 'POST') {
    const body = await readBody(event)
    const row = {
      event: String(body?.event || '').trim(),
      action: String(body?.action || '').trim(),
      config: body?.config ?? {},
      enabled: body?.enabled !== false,
      remark: body?.remark ? String(body.remark) : null,
    }
    if (!row.event || !row.action) {
      throw createError({ statusCode: 400, statusMessage: 'event 和 action 必填' })
    }
    const inserted = await db.insert(eventRules).values(row).returning()
    return inserted[0] ?? inserted
  }

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})
