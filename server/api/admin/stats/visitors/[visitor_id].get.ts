import { count, desc, eq, or } from 'drizzle-orm'
import { db } from '../../../../db/runtime'
import { orders, products, users, visitorEvents, visitorProfiles } from '../../../../db/schema'
import { toIsoTimestamp } from '../../../../utils/dbTime'
import { getRequestLocale } from '../../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const visitorId = String(getRouterParam(event, 'visitor_id') || '').trim()

  if (!visitorId || visitorId.length > 500) {
    throw createError({
      statusCode: 400,
      statusMessage: locale === 'zh' ? '无效的访客 ID' : 'Invalid visitor ID',
    })
  }

  const profile = (await db
    .select()
    .from(visitorProfiles)
    .where(eq(visitorProfiles.visitorId, visitorId))
    .limit(1))[0] as any

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: locale === 'zh' ? '访客不存在' : 'Visitor not found',
    })
  }

  const user = profile.userId
    ? (await db
        .select({
          id: users.id,
          email: users.email,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
          status: users.status,
          emailVerifiedAt: users.emailVerifiedAt,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, profile.userId))
        .limit(1))[0] as any
    : null

  const relatedOrderCondition = profile.userId
    ? or(
        eq(orders.visitorId, visitorId),
        eq(orders.userId, profile.userId)
      )
    : eq(orders.visitorId, visitorId)

  const [eventCountRows, eventSummaryRows, orderCountRows, recentEvents, relatedOrders] = await Promise.all([
    db
      .select({ value: count() })
      .from(visitorEvents)
      .where(eq(visitorEvents.visitorId, visitorId)),
    db
      .select({ eventName: visitorEvents.eventName, value: count() })
      .from(visitorEvents)
      .where(eq(visitorEvents.visitorId, visitorId))
      .groupBy(visitorEvents.eventName),
    db
      .select({ value: count() })
      .from(orders)
      .where(relatedOrderCondition),
    db
      .select({
        id: visitorEvents.id,
        eventName: visitorEvents.eventName,
        eventAction: visitorEvents.eventAction,
        path: visitorEvents.path,
        referrer: visitorEvents.referrer,
        sourceType: visitorEvents.sourceType,
        source: visitorEvents.source,
        medium: visitorEvents.medium,
        campaign: visitorEvents.campaign,
        content: visitorEvents.content,
        term: visitorEvents.term,
        ip: visitorEvents.ip,
        country: visitorEvents.country,
        region: visitorEvents.region,
        city: visitorEvents.city,
        locale: visitorEvents.locale,
        currency: visitorEvents.currency,
        deviceType: visitorEvents.deviceType,
        browser: visitorEvents.browser,
        os: visitorEvents.os,
        userAgent: visitorEvents.userAgent,
        userId: visitorEvents.userId,
        orderId: visitorEvents.orderId,
        productId: visitorEvents.productId,
        productName: products.name,
        createdAt: visitorEvents.createdAt,
      })
      .from(visitorEvents)
      .leftJoin(products, eq(visitorEvents.productId, products.id))
      .where(eq(visitorEvents.visitorId, visitorId))
      .orderBy(desc(visitorEvents.createdAt))
      .limit(100),
    db
      .select({
        id: orders.id,
        amount: orders.amount,
        currency: orders.currency,
        productId: orders.productId,
        productName: products.name,
        contactEmail: orders.contactEmail,
        payMethod: orders.payMethod,
        status: orders.status,
        payStatus: orders.payStatus,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(relatedOrderCondition)
      .orderBy(desc(orders.createdAt))
      .limit(50),
  ])

  const eventSummary = Object.fromEntries(
    (eventSummaryRows as any[]).map(item => [item.eventName, Number(item.value || 0)])
  )

  return {
    profile: {
      ...profile,
      firstSeenAt: toIsoTimestamp(profile.firstSeenAt),
      lastSeenAt: toIsoTimestamp(profile.lastSeenAt),
      createdAt: toIsoTimestamp(profile.createdAt),
      updatedAt: toIsoTimestamp(profile.updatedAt),
    },
    user: user
      ? {
          ...user,
          emailVerifiedAt: toIsoTimestamp(user.emailVerifiedAt),
          lastLoginAt: toIsoTimestamp(user.lastLoginAt),
          createdAt: toIsoTimestamp(user.createdAt),
        }
      : null,
    stats: {
      totalEvents: Number((eventCountRows as any[])[0]?.value || 0),
      pageViews: eventSummary.page_view || 0,
      productViews: eventSummary.product_view || 0,
      checkouts: eventSummary.begin_checkout || 0,
      paid: eventSummary.order_paid || 0,
      auth: eventSummary.auth || 0,
      orders: Number((orderCountRows as any[])[0]?.value || 0),
    },
    orders: (relatedOrders as any[]).map(order => ({
      ...order,
      createdAt: toIsoTimestamp(order.createdAt),
      paidAt: toIsoTimestamp(order.paidAt),
    })),
    recentEvents: (recentEvents as any[]).map(item => ({
      ...item,
      createdAt: toIsoTimestamp(item.createdAt),
    })),
    recentEventsLimit: 100,
  }
})
