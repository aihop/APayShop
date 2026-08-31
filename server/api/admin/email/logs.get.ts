import { emailLogs } from '../../../db/schema'
import { desc, like, eq, and, sql, or } from 'drizzle-orm'
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(Number(query.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100)
  const offset = (page - 1) * pageSize
  const search = (typeof query.search === 'string' ? query.search.trim() : '')
  const status = (typeof query.status === 'string' ? query.status.trim() : '')

  const conditions = []

  if (search) {
    conditions.push(
      or(
        like(emailLogs.to, `%${search}%`),
        like(emailLogs.subject, `%${search}%`),
        like(emailLogs.templateCode, `%${search}%`),
      ),
    )
  }

  if (status && (status === 'success' || status === 'failed')) {
    conditions.push(eq(emailLogs.status, status))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // 1. 查询总数
  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailLogs)
    .where(whereClause)

  const total = Number(countRes[0]?.count || 0)

  // 2. 分页查询列表
  const items = await db
    .select()
    .from(emailLogs)
    .where(whereClause)
    .orderBy(desc(emailLogs.createdAt), desc(emailLogs.id))
    .limit(pageSize)
    .offset(offset)

  return {
    items,
    total,
    page,
    pageSize,
  }
})
