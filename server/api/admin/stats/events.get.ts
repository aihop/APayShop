import { and, count, desc, eq, gte, lt } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { visitorEvents } from '../../../db/schema'
import { clampStatsPage, clampStatsPageSize, parseStatsRange } from '../../../utils/adminStats'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { preset, days, rangeStart, rangeEnd } = parseStatsRange(query)
  const page = clampStatsPage(query.page, 1)
  const pageSize = clampStatsPageSize(query.pageSize, 20)
  const offset = (page - 1) * pageSize

  const where = and(gte(visitorEvents.createdAt, rangeStart), lt(visitorEvents.createdAt, rangeEnd))

  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(visitorEvents)
    .where(where)

  const items = await db
    .select({
      id: visitorEvents.id,
      visitorId: visitorEvents.visitorId,
      userId: visitorEvents.userId,
      orderId: visitorEvents.orderId,
      productId: visitorEvents.productId,
      eventName: visitorEvents.eventName,
      eventAction: visitorEvents.eventAction,
      path: visitorEvents.path,
      sourceType: visitorEvents.sourceType,
      source: visitorEvents.source,
      campaign: visitorEvents.campaign,
      country: visitorEvents.country,
      deviceType: visitorEvents.deviceType,
      createdAt: visitorEvents.createdAt,
    })
    .from(visitorEvents)
    .where(where)
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
      ...item,
      source: item.campaign || item.source || item.sourceType || 'direct',
      country: item.country || 'Unknown',
      deviceType: item.deviceType || 'Unknown',
    })),
  }
})
