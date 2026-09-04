import { tickets } from '../../../db/schema'
import { eq, desc, count, and } from 'drizzle-orm'
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event).catch(() => null)
  const userId = (session?.user as any)?.id as number | undefined

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const page = Math.max(parseInt(query.page as string) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(query.pageSize as string) || 15, 1), 50)
  const offset = (page - 1) * pageSize
  const status = typeof query.status === 'string' && query.status.trim() ? query.status.trim() : ''
  const category = typeof query.category === 'string' && query.category.trim() ? query.category.trim() : ''

  const conditions = [eq(tickets.userId, userId)]

  if (status) {
    conditions.push(eq(tickets.status, status))
  }
  if (category) {
    conditions.push(eq(tickets.category, category))
  }

  const whereClause = and(...conditions)

  const [totalResult, list] = await Promise.all([
    db.select({ total: count() }).from(tickets).where(whereClause),
    db.select().from(tickets).where(whereClause).orderBy(desc(tickets.lastRepliedAt)).limit(pageSize).offset(offset),
  ])

  const total = Number(totalResult[0]?.total || 0)

  return {
    code: 200,
    data: list,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
})
