import { and, count, desc, gte, lt, sql } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { visitorEvents } from '../../../db/schema'
import { clampStatsPage, clampStatsPageSize, parseStatsRange } from '../../../utils/adminStats'
import { getConfiguredTimezone } from '../../../utils/timezone'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tz = await getConfiguredTimezone()
  const { preset, days, rangeStart, rangeEnd } = parseStatsRange(query, tz)
  const page = clampStatsPage(query.page, 1)
  const pageSize = clampStatsPageSize(query.pageSize, 20)
  const offset = (page - 1) * pageSize

  const timeFilter = and(gte(visitorEvents.createdAt, rangeStart), lt(visitorEvents.createdAt, rangeEnd))

  // Count distinct IPs for pagination
  const [{ value: totalItems }] = await db
    .select({ value: sql<number>`COUNT(DISTINCT ${visitorEvents.ip})` })
    .from(visitorEvents)
    .where(timeFilter)

  // Group by IP, aggregate visit info
  const items = await db
    .select({
      ip: visitorEvents.ip,
      visitCount: count(),
      visitorId: sql<string>`MAX(${visitorEvents.visitorId})`,
      userId: sql<number | null>`MAX(${visitorEvents.userId})`,
      country: sql<string | null>`MAX(${visitorEvents.country})`,
      region: sql<string | null>`MAX(${visitorEvents.region})`,
      city: sql<string | null>`MAX(${visitorEvents.city})`,
      deviceType: sql<string | null>`MAX(${visitorEvents.deviceType})`,
      browser: sql<string | null>`MAX(${visitorEvents.browser})`,
      os: sql<string | null>`MAX(${visitorEvents.os})`,
      firstSeenAt: sql<number>`MIN(${visitorEvents.createdAt})`,
      lastSeenAt: sql<number>`MAX(${visitorEvents.createdAt})`,
    })
    .from(visitorEvents)
    .where(timeFilter)
    .groupBy(visitorEvents.ip)
    .orderBy(desc(sql`MAX(${visitorEvents.createdAt})`))
    .limit(pageSize)
    .offset(offset)

  // Normalize timestamps: SQLite MIN/MAX returns seconds, convert to ISO string
  const toIso = (val: any): string => {
    if (!val && val !== 0) return new Date(0).toISOString()
    const ms = typeof val === 'number' && val < 1e12 ? val * 1000 : Number(val)
    return new Date(ms).toISOString()
  }

  return {
    range: {
      preset,
      days,
      from: rangeStart,
      to: rangeEnd,
    },
    pagination: {
      page,
      pageSize,
      totalItems: Number(totalItems || 0),
      totalPages: Math.max(1, Math.ceil(Number(totalItems || 0) / pageSize)),
    },
    items: (items as any[]).map(item => ({
      ip: item.ip,
      visitorId: item.visitorId,
      userId: item.userId || null,
      visitCount: item.visitCount,
      isRegistered: !!item.userId,
      country: item.country || 'Unknown',
      region: item.region || null,
      city: item.city || null,
      deviceType: item.deviceType || 'Unknown',
      browser: item.browser || null,
      os: item.os || null,
      firstSeenAt: toIso(item.firstSeenAt),
      lastSeenAt: toIso(item.lastSeenAt),
    })),
  }
})
