import { accessLogs } from "../../../db/schema"
import { desc, count, sql } from "drizzle-orm"
import { db } from '../../../db/runtime'

const normalizeCreatedAt = (value: unknown) => {
  if (!value) return ''

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }

  if (typeof value === 'number') {
    const timestamp = value < 1e12 ? value * 1000 : value
    const date = new Date(timestamp)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed)
      const date = new Date(trimmed.length <= 10 ? numeric * 1000 : numeric)
      return Number.isNaN(date.getTime()) ? trimmed : date.toISOString()
    }

    const sqliteTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
      ? `${trimmed.replace(' ', 'T')}Z`
      : trimmed
    const date = new Date(sqliteTimestamp)
    return Number.isNaN(date.getTime()) ? trimmed : date.toISOString()
  }

  return ''
}

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
    createdAt: normalizeCreatedAt(log.createdAt),
  }))

  return {
    logs: normalizedLogs,
    total,
    page,
    pageSize,
  }
})
