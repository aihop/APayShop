import { tickets, users } from '../../../db/schema'
import { eq, desc, count, and, sql, or, like } from 'drizzle-orm'
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(parseInt(query.page as string) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(query.pageSize as string) || 15, 1), 100)
  const offset = (page - 1) * pageSize

  const status = typeof query.status === 'string' && query.status.trim() ? query.status.trim() : ''
  const category = typeof query.category === 'string' && query.category.trim() ? query.category.trim() : ''
  const priority = typeof query.priority === 'string' && query.priority.trim() ? query.priority.trim() : ''
  const keyword = typeof query.keyword === 'string' && query.keyword.trim() ? query.keyword.trim() : ''

  const conditions = []

  if (status) {
    conditions.push(eq(tickets.status, status))
  }
  if (category) {
    conditions.push(eq(tickets.category, category))
  }
  if (priority) {
    conditions.push(eq(tickets.priority, priority))
  }
  if (keyword) {
    const pattern = `%${keyword}%`
    conditions.push(
      or(
        like(tickets.ticketNo, pattern),
        like(tickets.title, pattern),
        like(users.email, pattern),
      )
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // 主查询：联合 users 表
  const queryBuilder = db
    .select({
      id: tickets.id,
      ticketNo: tickets.ticketNo,
      userId: tickets.userId,
      userEmail: users.email,
      userNickname: users.nickname,
      category: tickets.category,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      context: tickets.context,
      lastRepliedAt: tickets.lastRepliedAt,
      lastRepliedBy: tickets.lastRepliedBy,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.userId, users.id))
    .where(whereClause)
    .orderBy(desc(tickets.lastRepliedAt))
    .limit(pageSize)
    .offset(offset)

  // 统计总数与各状态聚合数
  const [totalResult, list, statusCounts] = await Promise.all([
    db
      .select({ total: count() })
      .from(tickets)
      .leftJoin(users, eq(tickets.userId, users.id))
      .where(whereClause),
    queryBuilder,
    db
      .select({
        status: tickets.status,
        count: count(),
      })
      .from(tickets)
      .groupBy(tickets.status),
  ])

  const total = Number(totalResult[0]?.total || 0)

  const summary = {
    all: 0,
    open: 0,
    in_progress: 0,
    auto_resolved: 0,
    resolved: 0,
    closed: 0,
  }

  for (const item of statusCounts) {
    const cnt = Number(item.count || 0)
    summary.all += cnt
    if (item.status in summary) {
      summary[item.status as keyof typeof summary] = cnt
    }
  }

  return {
    code: 200,
    data: list,
    summary,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
})
