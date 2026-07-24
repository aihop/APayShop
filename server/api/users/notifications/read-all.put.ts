import { notifications } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session = await getUserSession(event).catch(() => null)
  const userId = session?.user?.id as number | undefined

  const conditions = []
  if (userId) {
    conditions.push(eq(notifications.userId, userId))
  } else {
    const visitorId = getCookie(event, 'visitorId') || ''
    if (visitorId) {
      conditions.push(eq(notifications.visitorId, visitorId))
    } else {
      throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
    }
  }

  conditions.push(eq(notifications.isRead, false))

  await db.update(notifications).set({ isRead: true }).where(and(...conditions))
  return { ok: true }
})
