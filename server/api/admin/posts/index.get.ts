import { posts } from "../../../db/schema"
import { desc, count, eq, and, or, like, sql } from "drizzle-orm"
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 15))
  const offset = (page - 1) * pageSize

  const type = String(query.type || '').trim()
  const status = String(query.status || '').trim() // 'all' | 'published' | 'draft'
  const search = String(query.search || '').trim()

  const conditions = []

  if (type && type !== 'all') {
    conditions.push(eq(posts.type, type))
  }

  if (status === 'published') {
    conditions.push(eq(posts.isActive, true))
  } else if (status === 'draft') {
    conditions.push(eq(posts.isActive, false))
  }

  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(
        like(posts.title, pattern),
        like(posts.slug, pattern),
        like(posts.key, pattern),
        like(posts.description, pattern)
      )
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // 1. 获取当前筛选条件下的总记录数与列表数据
  const [totalResult, result] = await Promise.all([
    db.select({ value: count() }).from(posts).where(whereClause),
    db.select()
      .from(posts)
      .where(whereClause)
      .orderBy(desc(posts.createdAt))
      .limit(pageSize)
      .offset(offset),
  ])

  const total = totalResult[0]?.value || 0

  // 2. 获取全局汇总统计指标（供顶部 Metric Cards 展示）
  const [statsResult] = await db
    .select({
      totalAll: count(),
      publishedCount: sql<number>`SUM(CASE WHEN ${posts.isActive} = true THEN 1 ELSE 0 END)`,
      draftCount: sql<number>`SUM(CASE WHEN ${posts.isActive} = false THEN 1 ELSE 0 END)`,
      totalViews: sql<number>`COALESCE(SUM(${posts.views}), 0)`,
    })
    .from(posts)

  return {
    data: result,
    total,
    page,
    pageSize,
    stats: {
      total: Number(statsResult?.totalAll || 0),
      published: Number(statsResult?.publishedCount || 0),
      draft: Number(statsResult?.draftCount || 0),
      totalViews: Number(statsResult?.totalViews || 0),
    },
  }
})
