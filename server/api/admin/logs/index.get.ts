import { logs } from "../../../db/schema"
import { desc, count } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 50
  
  const offset = (page - 1) * pageSize

  // Get total count
  const [{ value: total }] = await db.select({ value: count() }).from(logs)

  // Get paginated data
  const result = await db.select()
    .from(logs)
    .orderBy(desc(logs.createdAt))
    .limit(pageSize)
    .offset(offset)

  return {
    logs: result,
    total,
    page,
    pageSize
  }
})