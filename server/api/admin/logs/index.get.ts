import { logs } from "../../../db/schema"
import { desc, count } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { toIsoTimestamp } from '../../../utils/dbTime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 50
  
  const offset = (page - 1) * pageSize

  // Get total count
  const [{ value: total }] = await db.select({ value: count() }).from(logs)

  // Get paginated data
  const result = await db.select({
    id: logs.id,
    level: logs.level,
    message: logs.message,
    details: logs.details,
    source: logs.source,
    createdAt: logs.createdAt
  })
    .from(logs)
    .orderBy(desc(logs.createdAt))
    .limit(pageSize)
    .offset(offset)

  const normalizedLogs = result.map((log: typeof result[number]) => ({
    ...log,
    createdAt: toIsoTimestamp(log.createdAt),
  }))

  return {
    logs: normalizedLogs,
    total,
    page,
    pageSize
  }
})
