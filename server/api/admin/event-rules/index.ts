import { eventRules } from '../../../db/schema'
import { db } from '../../../db/runtime'
import { desc } from 'drizzle-orm'
import { getRequestLocale } from '../../../utils/requestLocale'

// 事件自动化规则:列表 / 新建。(/api/admin 由 server/middleware/auth.ts 守鉴权)
export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
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
      throw createError({ statusCode: 400, statusMessage: locale === 'zh' ? 'event 和 action 必填' : 'event and action are required' })
    }
    const inserted = await db.insert(eventRules).values(row).returning()
    return inserted[0] ?? inserted
  }

  throw createError({ statusCode: 405, statusMessage: locale === 'zh' ? '请求方法不允许' : 'Method Not Allowed' })
})
