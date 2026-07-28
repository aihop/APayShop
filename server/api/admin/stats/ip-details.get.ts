import { and, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { products, users, visitorEvents, visitorProfiles } from '../../../db/schema'
import { parseStatsRange } from '../../../utils/adminStats'
import { toIsoTimestampOrEpoch } from '../../../utils/dbTime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { getConfiguredTimezone } from '../../../utils/timezone'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const isLocal = query.local === '1'
  const ip = String(query.ip || '').trim()

  if ((!isLocal && !ip) || ip.length > 128) {
    throw createError({
      statusCode: 400,
      statusMessage: locale === 'zh' ? '无效的 IP' : 'Invalid IP address',
    })
  }

  const timezone = await getConfiguredTimezone()
  const { preset, days, rangeStart, rangeEnd } = parseStatsRange(query, timezone)
  const ipCondition = isLocal
    ? sql`${visitorEvents.ip} IS NULL`
    : eq(visitorEvents.ip, ip)
  const eventFilter = and(
    gte(visitorEvents.createdAt, rangeStart),
    lt(visitorEvents.createdAt, rangeEnd),
    ipCondition
  )

  const [summaryRows, eventSummaryRows, visitorRows, contextRows, recentEvents] = await Promise.all([
    db
      .select({
        totalEvents: count(),
        uniqueVisitors: sql<number>`COUNT(DISTINCT ${visitorEvents.visitorId})`,
        registeredUsers: sql<number>`COUNT(DISTINCT ${visitorEvents.userId})`,
        firstSeenAt: sql<number>`MIN(${visitorEvents.createdAt})`,
        lastSeenAt: sql<number>`MAX(${visitorEvents.createdAt})`,
      })
      .from(visitorEvents)
      .where(eventFilter),
    db
      .select({ eventName: visitorEvents.eventName, value: count() })
      .from(visitorEvents)
      .where(eventFilter)
      .groupBy(visitorEvents.eventName),
    db
      .select({
        visitorId: visitorEvents.visitorId,
        userId: sql<number | null>`MAX(${visitorEvents.userId})`,
        eventCount: count(),
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
      .where(eventFilter)
      .groupBy(visitorEvents.visitorId)
      .orderBy(desc(sql`MAX(${visitorEvents.createdAt})`))
      .limit(100),
    db
      .select({
        country: visitorEvents.country,
        region: visitorEvents.region,
        city: visitorEvents.city,
        deviceType: visitorEvents.deviceType,
        browser: visitorEvents.browser,
        os: visitorEvents.os,
        count: count(),
      })
      .from(visitorEvents)
      .where(eventFilter)
      .groupBy(
        visitorEvents.country,
        visitorEvents.region,
        visitorEvents.city,
        visitorEvents.deviceType,
        visitorEvents.browser,
        visitorEvents.os
      )
      .orderBy(desc(count()))
      .limit(20),
    db
      .select({
        id: visitorEvents.id,
        visitorId: visitorEvents.visitorId,
        userId: visitorEvents.userId,
        eventName: visitorEvents.eventName,
        eventAction: visitorEvents.eventAction,
        path: visitorEvents.path,
        referrer: visitorEvents.referrer,
        sourceType: visitorEvents.sourceType,
        source: visitorEvents.source,
        medium: visitorEvents.medium,
        campaign: visitorEvents.campaign,
        country: visitorEvents.country,
        region: visitorEvents.region,
        city: visitorEvents.city,
        deviceType: visitorEvents.deviceType,
        browser: visitorEvents.browser,
        os: visitorEvents.os,
        userAgent: visitorEvents.userAgent,
        orderId: visitorEvents.orderId,
        productId: visitorEvents.productId,
        productName: products.name,
        createdAt: visitorEvents.createdAt,
      })
      .from(visitorEvents)
      .leftJoin(products, eq(visitorEvents.productId, products.id))
      .where(eventFilter)
      .orderBy(desc(visitorEvents.createdAt))
      .limit(100),
  ])

  const visitorIds = (visitorRows as any[]).map(item => item.visitorId)
  const userIds = (visitorRows as any[]).map(item => item.userId).filter(Boolean) as number[]
  const [profiles, userRows] = await Promise.all([
    visitorIds.length
      ? db.select().from(visitorProfiles).where(inArray(visitorProfiles.visitorId, visitorIds))
      : [],
    userIds.length
      ? db
          .select({
            id: users.id,
            email: users.email,
            nickname: users.nickname,
            status: users.status,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [],
  ])

  const profileMap = new Map((profiles as any[]).map(item => [item.visitorId, item]))
  const userMap = new Map((userRows as any[]).map(item => [item.id, item]))
  const eventSummary = Object.fromEntries(
    (eventSummaryRows as any[]).map(item => [item.eventName, Number(item.value || 0)])
  )
  const summary = (summaryRows as any[])[0] || {}

  return {
    ip: isLocal ? null : ip,
    range: { preset, days, from: rangeStart, to: rangeEnd },
    stats: {
      totalEvents: Number(summary.totalEvents || 0),
      uniqueVisitors: Number(summary.uniqueVisitors || 0),
      registeredUsers: Number(summary.registeredUsers || 0),
      pageViews: eventSummary.page_view || 0,
      productViews: eventSummary.product_view || 0,
      checkouts: eventSummary.begin_checkout || 0,
      paid: eventSummary.order_paid || 0,
      auth: eventSummary.auth || 0,
      firstSeenAt: toIsoTimestampOrEpoch(summary.firstSeenAt),
      lastSeenAt: toIsoTimestampOrEpoch(summary.lastSeenAt),
    },
    visitors: (visitorRows as any[]).map(item => {
      const profile = profileMap.get(item.visitorId) as any
      const user = item.userId ? userMap.get(item.userId) as any : null
      return {
        ...item,
        eventCount: Number(item.eventCount || 0),
        firstSeenAt: toIsoTimestampOrEpoch(item.firstSeenAt),
        lastSeenAt: toIsoTimestampOrEpoch(item.lastSeenAt),
        firstTouch: profile?.firstCampaign || profile?.firstSource || profile?.firstSourceType || 'direct',
        lastTouch: profile?.lastCampaign || profile?.lastSource || profile?.lastSourceType || 'direct',
        user: user
          ? { ...user, createdAt: toIsoTimestampOrEpoch(user.createdAt) }
          : null,
      }
    }),
    visitorLimit: 100,
    contexts: (contextRows as any[]).map(item => ({
      ...item,
      count: Number(item.count || 0),
    })),
    recentEvents: (recentEvents as any[]).map(item => ({
      ...item,
      createdAt: toIsoTimestampOrEpoch(item.createdAt),
    })),
    recentEventsLimit: 100,
  }
})
