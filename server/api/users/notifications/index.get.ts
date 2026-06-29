import { notifications } from '../../../db/schema'
import { eq, desc, count, and, or, isNull } from 'drizzle-orm'
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user?.id as number | undefined

  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 20
  const offset = (page - 1) * pageSize
  const unreadOnly = query.unread === '1'

  // Build filter: match userId if logged in, otherwise match visitorId
  const conditions = []
  if (userId) {
    conditions.push(eq(notifications.userId, userId))
  } else {
    const visitorId = getCookie(event, 'visitorId') || ''
    if (visitorId) {
      conditions.push(eq(notifications.visitorId, visitorId))
    } else {
      return { data: [], total: 0, page, pageSize }
    }
  }

  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, false))
  }

  const filter = and(...conditions)

  const totalResult = await db.select({ value: count() }).from(notifications).where(filter)
  const total = totalResult[0]?.value || 0

  const rows = await db.select()
    .from(notifications)
    .where(filter)
    .orderBy(desc(notifications.createdAt))
    .limit(pageSize)
    .offset(offset)

  // Normalize createdAt to ISO string
  const data = rows.map((row) => ({
    ...row,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  }))

  return { data, total, page, pageSize }
})
