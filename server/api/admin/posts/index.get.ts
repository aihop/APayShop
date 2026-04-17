import { posts } from "../../../db/schema"
import { desc, count } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 15
  const offset = (page - 1) * pageSize

  // Get total count
  const totalResult = await db.select({ value: count() }).from(posts)
  const total = totalResult[0]?.value || 0

  const result = await db.select()
    .from(posts)
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
