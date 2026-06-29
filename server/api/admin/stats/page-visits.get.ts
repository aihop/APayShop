import { and, count, desc, eq, gte, lt } from 'drizzle-orm'
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

  const filter = and(
    gte(visitorEvents.createdAt, rangeStart),
    lt(visitorEvents.createdAt, rangeEnd),
    eq(visitorEvents.eventName, 'page_view')
  )

  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(visitorEvents)
    .where(filter)

  const items = await db
    .select({
      id: visitorEvents.id,
      visitorId: visitorEvents.visitorId,
      userId: visitorEvents.userId,
      path: visitorEvents.path,
      referrer: visitorEvents.referrer,
      ip: visitorEvents.ip,
      country: visitorEvents.country,
      region: visitorEvents.region,
      city: visitorEvents.city,
      deviceType: visitorEvents.deviceType,
      browser: visitorEvents.browser,
      os: visitorEvents.os,
      createdAt: visitorEvents.createdAt,
    })
    .from(visitorEvents)
    .where(filter)
    .orderBy(desc(visitorEvents.createdAt))
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
      id: item.id,
      visitorId: item.visitorId,
      userId: item.userId || null,
      path: item.path || '/',
      referrer: item.referrer || null,
      ip: item.ip || null,
      country: item.country || null,
      region: item.region || null,
      city: item.city || null,
      deviceType: item.deviceType || null,
      browser: item.browser || null,
      os: item.os || null,
      createdAt: item.createdAt,
    })),
  }
})
