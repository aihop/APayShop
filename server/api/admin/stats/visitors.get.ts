import { and, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { users, visitorEvents, visitorProfiles } from '../../../db/schema'
import { clampStatsPage, clampStatsPageSize, parseStatsRange } from '../../../utils/adminStats'
import { getConfiguredTimezone } from '../../../utils/timezone'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tz = await getConfiguredTimezone()
  const { preset, days, rangeStart, rangeEnd } = parseStatsRange(query, tz)
  const page = clampStatsPage(query.page, 1)
  const pageSize = clampStatsPageSize(query.pageSize, 20)
  const offset = (page - 1) * pageSize
  const eventType = query.type as string | undefined
  const sourceType = query.sourceType as string | undefined
  const host = getRequestHost(event)

  // If eventType is set, first find matching visitorIds
  let matchingVisitorIds: string[] | null = null
  if (eventType) {
    if (eventType === 'auth') {
      // For 'auth' type: include both visitors who triggered an auth event in range
      // AND visitors whose profile has userId set (registered users who visited)
      const fromEvents = await db
        .select({ visitorId: visitorEvents.visitorId })
        .from(visitorEvents)
        .where(
          and(
            gte(visitorEvents.createdAt, rangeStart),
            lt(visitorEvents.createdAt, rangeEnd),
            eq(visitorEvents.eventName, eventType)
          )
        )
        .groupBy(visitorEvents.visitorId)

      const fromProfiles = await db
        .select({ visitorId: visitorProfiles.visitorId })
        .from(visitorProfiles)
        .where(
          and(
            gte(visitorProfiles.lastSeenAt, rangeStart),
            lt(visitorProfiles.lastSeenAt, rangeEnd),
            sql`${visitorProfiles.userId} IS NOT NULL`
          )
        )

      const mergedIds = new Set([
        ...fromEvents.map((r: any) => r.visitorId),
        ...fromProfiles.map((r: any) => r.visitorId),
      ])
      matchingVisitorIds = Array.from(mergedIds)
    } else {
      const rows = await db
        .select({ visitorId: visitorEvents.visitorId })
        .from(visitorEvents)
        .where(
          and(
            gte(visitorEvents.createdAt, rangeStart),
            lt(visitorEvents.createdAt, rangeEnd),
            eq(visitorEvents.eventName, eventType)
          )
        )
        .groupBy(visitorEvents.visitorId)
      matchingVisitorIds = rows.map((r: any) => r.visitorId)
    }
  } else if (sourceType === 'external') {
    // Find visitors whose referrer URL is not from the current site
    const rows = await db
      .select({ visitorId: visitorEvents.visitorId })
      .from(visitorEvents)
      .where(
        and(
          gte(visitorEvents.createdAt, rangeStart),
          lt(visitorEvents.createdAt, rangeEnd),
          sql`${visitorEvents.referrer} IS NOT NULL AND ${visitorEvents.referrer} != '' AND ${visitorEvents.referrer} NOT LIKE '%${sql.raw(host)}%'`
        )
      )
      .groupBy(visitorEvents.visitorId)
    matchingVisitorIds = rows.map((r: any) => r.visitorId)
  }

  // Build profile filter
  const profileConditions = [
    gte(visitorProfiles.lastSeenAt, rangeStart),
    lt(visitorProfiles.lastSeenAt, rangeEnd),
  ]
  if (matchingVisitorIds !== null) {
    profileConditions.push(inArray(visitorProfiles.visitorId, matchingVisitorIds.length > 0 ? matchingVisitorIds : ['__none__']))
  }
  if (sourceType === 'campaign') {
    profileConditions.push(
      sql`(${visitorProfiles.firstCampaign} IS NOT NULL OR ${visitorProfiles.lastCampaign} IS NOT NULL)`
    )
  }

  const profileFilter = and(...profileConditions)

  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(visitorProfiles)
    .where(profileFilter)

  const profiles = await db
    .select()
    .from(visitorProfiles)
    .where(profileFilter)
    .orderBy(desc(visitorProfiles.lastSeenAt))
    .limit(pageSize)
    .offset(offset)

  const visitorIds = profiles.map((item: any) => item.visitorId).filter(Boolean)

  // Fetch user info for registered visitors
  const userIds = profiles.map((p: any) => p.userId).filter(Boolean)
  const userMap = new Map<number, { email: string; nickname: string | null }>()
  if (userIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, email: users.email, nickname: users.nickname })
      .from(users)
      .where(inArray(users.id, userIds as number[]))
    for (const u of userRows as any[]) {
      userMap.set(u.id, { email: u.email, nickname: u.nickname })
    }
  }

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
        user: profile.userId ? (userMap.get(profile.userId) || null) : null,
        ip: profile.ip,
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
