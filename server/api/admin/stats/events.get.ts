import { and, count, desc, gte, lt, sql } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { visitorEvents } from '../../../db/schema'
import { clampStatsPage, clampStatsPageSize, parseStatsRange } from '../../../utils/adminStats'
import { getRequestLocale } from '../../../utils/requestLocale'
import { getConfiguredTimezone } from '../../../utils/timezone'
import { toIsoTimestampOrEpoch } from '../../../utils/dbTime'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const unknownLabel = locale === 'zh' ? '未知' : 'Unknown'
  const query = getQuery(event)
  const tz = await getConfiguredTimezone()
  const { preset, days, rangeStart, rangeEnd } = parseStatsRange(query, tz)
  const page = clampStatsPage(query.page, 1)
  const pageSize = clampStatsPageSize(query.pageSize, 20)
  const offset = (page - 1) * pageSize

  const timeFilter = and(gte(visitorEvents.createdAt, rangeStart), lt(visitorEvents.createdAt, rangeEnd))

  // Count of GROUP BY ip buckets, which is NOT COUNT(DISTINCT ip): SQL skips
  // NULL in COUNT(DISTINCT), while GROUP BY emits one row for it. That mismatch
  // reported totalItems=0 for a page that actually returned a row. The MAX(CASE…)
  // form adds the NULL bucket back and works on Postgres, SQLite and MySQL alike
  // (FILTER / COUNT(*) OVER would not).
  const [{ value: totalItems }] = await db
    .select({
      value: sql<number>`COUNT(DISTINCT ${visitorEvents.ip})
        + COALESCE(MAX(CASE WHEN ${visitorEvents.ip} IS NULL THEN 1 ELSE 0 END), 0)`,
    })
    .from(visitorEvents)
    .where(timeFilter)

  // Group by IP, aggregate visit info
  const items = await db
    .select({
      ip: visitorEvents.ip,
      visitCount: count(),
      visitorId: sql<string>`MAX(${visitorEvents.visitorId})`,
      visitorCount: sql<number>`COUNT(DISTINCT ${visitorEvents.visitorId})`,
      userId: sql<number | null>`MAX(${visitorEvents.userId})`,
      registeredUserCount: sql<number>`COUNT(DISTINCT ${visitorEvents.userId})`,
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
      visitorCount: Number(item.visitorCount || 0),
      userId: item.userId || null,
      registeredUserCount: Number(item.registeredUserCount || 0),
      visitCount: item.visitCount,
      isRegistered: !!item.userId,
      country: item.country || unknownLabel,
      region: item.region || null,
      city: item.city || null,
      deviceType: item.deviceType || unknownLabel,
      browser: item.browser || null,
      os: item.os || null,
      // MIN/MAX are raw sql`` fragments, so no drizzle column mapper runs and
      // the value arrives dialect-shaped (Postgres string / SQLite seconds).
      firstSeenAt: toIsoTimestampOrEpoch(item.firstSeenAt),
      lastSeenAt: toIsoTimestampOrEpoch(item.lastSeenAt),
    })),
  }
})
