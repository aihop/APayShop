import { notifications } from '../../../db/schema'
import { eq, and, count } from 'drizzle-orm'
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
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
      return { unreadCount: 0 }
    }
  }

  conditions.push(eq(notifications.isRead, false))

  const result = await db.select({ value: count() }).from(notifications).where(and(...conditions))
  return { unreadCount: result[0]?.value || 0 }
})
