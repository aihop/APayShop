import { eventRules } from '../../../db/schema'
import { db } from '../../../db/runtime'
import { desc } from 'drizzle-orm'
import { getRequestLocale } from '../../../utils/requestLocale'

import { loadActiveThemeEventRules } from '../../../utils/themeEvents'

// 事件自动化规则:列表 / 新建。(/api/admin 由 server/middleware/auth.ts 守鉴权)
export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)

  if (event.method === 'GET') {
    let dbRules: any[] = []
    try {
      dbRules = await db.select().from(eventRules).orderBy(desc(eventRules.id))
    } catch {
      dbRules = []
    }

    const registeredThemeRules = await loadActiveThemeEventRules()

    // 转换已注册的主题内置规则（只读展示，自动生效）
    const themeRules = registeredThemeRules.map(action => ({
      id: `builtin:${action.key}`,
      event: action.event,
      action: action.key,
      config: {
        mode: action.mode || 'async',
        isBuiltin: true,
        theme: action.theme,
        description: action.description,
      },
      enabled: true,
      remark: action.label,
      isBuiltin: true,
      theme: action.theme,
    }))

    return [...themeRules, ...dbRules]
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
