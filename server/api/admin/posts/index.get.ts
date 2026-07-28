import { posts } from "../../../db/schema"
import { desc, count, eq } from "drizzle-orm"
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 15
  const offset = (page - 1) * pageSize
  // Optional — omitted keeps the existing "all types mixed" behavior for the
  // main list; callers that need one type (e.g. the changelog version
  // auto-fill) pass it explicitly.
  const type = query.type as string | undefined
  const whereClause = type ? eq(posts.type, type) : undefined

  const totalResult = await db.select({ value: count() }).from(posts).where(whereClause)
  const total = totalResult[0]?.value || 0

  const result = await db.select()
    .from(posts)
    .where(whereClause)
    .orderBy(desc(posts.createdAt))
    .limit(pageSize)
    .offset(offset)

  return {
    data: result,
    total,
    page,
    pageSize
  }
})
