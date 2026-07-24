import { notifications } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event).catch(() => null)
  const userId = session?.user?.id as number | undefined
  const notificationId = parseInt(getRouterParam(event, 'id') || '0')

  if (!notificationId) {
    throw createError({ statusCode: 400, message: 'Invalid notification ID' })
  }

  const conditions = [eq(notifications.id, notificationId)]
  if (userId) {
    conditions.push(eq(notifications.userId, userId))
  } else {
    const visitorId = getCookie(event, 'visitorId') || ''
    if (visitorId) {
      conditions.push(eq(notifications.visitorId, visitorId))
    } else {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
  }

  await db.update(notifications).set({ isRead: true }).where(and(...conditions))
  return { ok: true }
})
