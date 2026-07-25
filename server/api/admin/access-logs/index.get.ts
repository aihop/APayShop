import { accessLogs } from "../../../db/schema"
import { desc, count, sql } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { toIsoTimestamp } from '../../../utils/dbTime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 50
  const pathFilter = typeof query.path === 'string' ? query.path.trim() : ''
  const methodFilter = typeof query.method === 'string' ? query.method.trim().toUpperCase() : ''
  const statusFilter = typeof query.status === 'string' ? query.status.trim() : ''
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const offset = (page - 1) * pageSize

  // Build where conditions
  const conditions: any[] = []

  if (pathFilter) {
    conditions.push(sql`${accessLogs.path} LIKE ${`%${pathFilter}%`}`)
  }
  if (methodFilter) {
    conditions.push(sql`${accessLogs.method} = ${methodFilter}`)
  }
  if (statusFilter) {
    conditions.push(sql`CAST(${accessLogs.statusCode} AS TEXT) LIKE ${`${statusFilter}%`}`)
  }
  if (search) {
    conditions.push(sql`(
      ${accessLogs.path} LIKE ${`%${search}%`}
      OR ${accessLogs.ip} LIKE ${`%${search}%`}
      OR ${accessLogs.visitorId} LIKE ${`%${search}%`}
    )`)
  }

  const where = conditions.length > 0
    ? conditions.reduce((acc, c) => sql`${acc} AND ${c}`)
    : undefined

  // Get total count
  const countResult = where
    ? await db.select({ value: count() }).from(accessLogs).where(where)
    : await db.select({ value: count() }).from(accessLogs)
  const [{ value: total }] = countResult

  // Build query
  let queryBuilder = db.select({
    id: accessLogs.id,
    path: accessLogs.path,
    method: accessLogs.method,
    ip: accessLogs.ip,
    userAgent: accessLogs.userAgent,
    referrer: accessLogs.referrer,
    country: accessLogs.country,
    region: accessLogs.region,
    city: accessLogs.city,
    statusCode: accessLogs.statusCode,
    duration: accessLogs.duration,
    visitorId: accessLogs.visitorId,
    userId: accessLogs.userId,
    createdAt: accessLogs.createdAt,
  })
    .from(accessLogs)
    .orderBy(desc(accessLogs.createdAt))
    .limit(pageSize)
    .offset(offset)

  if (where) {
    queryBuilder = queryBuilder.where(where) as any
  }

  const result = await queryBuilder

  const normalizedLogs = result.map((log: any) => ({
    ...log,
    createdAt: toIsoTimestamp(log.createdAt),
  }))

  return {
    logs: normalizedLogs,
    total,
    page,
    pageSize,
  }
})
