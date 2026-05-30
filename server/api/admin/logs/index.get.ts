import { logs } from "../../../db/schema"
import { desc, count } from "drizzle-orm"
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
    createdAt: normalizeCreatedAt(log.createdAt),
  }))

  return {
    logs: normalizedLogs,
    total,
    page,
    pageSize
  }
})
