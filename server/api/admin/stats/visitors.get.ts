import { and, count, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { visitorEvents, visitorProfiles } from '../../../db/schema'
import { clampStatsPage, clampStatsPageSize, parseStatsRange } from '../../../utils/adminStats'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { preset, days, rangeStart, rangeEnd } = parseStatsRange(query)
  const page = clampStatsPage(query.page, 1)
  const pageSize = clampStatsPageSize(query.pageSize, 20)
  const offset = (page - 1) * pageSize

  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(visitorProfiles)
    .where(and(gte(visitorProfiles.lastSeenAt, rangeStart), lt(visitorProfiles.lastSeenAt, rangeEnd)))

  const profiles = await db
    .select()
    .from(visitorProfiles)
    .where(and(gte(visitorProfiles.lastSeenAt, rangeStart), lt(visitorProfiles.lastSeenAt, rangeEnd)))
    .orderBy(desc(visitorProfiles.lastSeenAt))
    .limit(pageSize)
    .offset(offset)

  const visitorIds = profiles.map((item: any) => item.visitorId).filter(Boolean)

  const events = visitorIds.length > 0
    ? await db
        .select({
          visitorId: visitorEvents.visitorId,
          eventName: visitorEvents.eventName,
        })
        .from(visitorEvents)
        .where(
          and(
            gte(visitorEvents.createdAt, rangeStart),
            lt(visitorEvents.createdAt, rangeEnd),
            inArray(visitorEvents.visitorId, visitorIds)
          )
        )
    : []

  const statsMap = new Map<string, {
    pageViews: number
    productViews: number
    checkouts: number
    paid: number
    auth: number
  }>()

  for (const eventItem of events as any[]) {
    const stats = statsMap.get(eventItem.visitorId) || {
      pageViews: 0,
      productViews: 0,
      checkouts: 0,
      paid: 0,
      auth: 0,
    }

    if (eventItem.eventName === 'page_view') stats.pageViews += 1
    if (eventItem.eventName === 'product_view') stats.productViews += 1
    if (eventItem.eventName === 'begin_checkout') stats.checkouts += 1
    if (eventItem.eventName === 'order_paid') stats.paid += 1
    if (eventItem.eventName === 'auth') stats.auth += 1

    statsMap.set(eventItem.visitorId, stats)
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
    items: (profiles as any[]).map(profile => {
      const stats = statsMap.get(profile.visitorId) || {
        pageViews: 0,
        productViews: 0,
        checkouts: 0,
        paid: 0,
        auth: 0,
      }

      return {
        visitorId: profile.visitorId,
        userId: profile.userId,
        firstTouch: profile.firstCampaign || profile.firstSource || profile.firstSourceType || 'direct',
        lastTouch: profile.lastCampaign || profile.lastSource || profile.lastSourceType || 'direct',
        country: profile.country || 'Unknown',
        deviceType: profile.deviceType || 'Unknown',
        landingPath: profile.landingPath || profile.firstPath || '/',
        lastPath: profile.lastPath || '/',
        firstSeenAt: profile.firstSeenAt,
        lastSeenAt: profile.lastSeenAt,
        pageViews: stats.pageViews,
        productViews: stats.productViews,
        checkouts: stats.checkouts,
        paid: stats.paid,
        auth: stats.auth,
      }
    }),
  }
})
