import { orders, products, users, visitorProfiles } from "../../../db/schema"
import { eq, and, or, desc, isNull, sql } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const email = String(query.email || '').trim()
  const visitorId = String(query.visitorId || '').trim()
  const isAnonymous = !email || email === 'Anonymous' || email === '匿名访客'

  if (!email && !visitorId) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '缺少客户标识' : 'Missing customer identifier',
    })
  }

  try {
    // Named customers are matched by contact email — the same person may
    // have checked out across multiple visitor sessions/devices, so email
    // (not visitorId) is the identity for their full order history.
    // Anonymous customers only ever have a visitorId to key off of.
    const orderWhere = isAnonymous
      ? and(
          or(isNull(orders.contactEmail), eq(orders.contactEmail, '')),
          eq(orders.visitorId, visitorId),
        )
      : eq(orders.contactEmail, email)

    const orderRows = await db.select({
      id: orders.id,
      amount: orders.amount,
      currency: orders.currency,
      status: orders.status,
      payStatus: orders.payStatus,
      payMethod: orders.payMethod,
      tradeNo: orders.tradeNo,
      visitorId: orders.visitorId,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      productImage: products.imageUrl,
    })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(orderWhere)
      .orderBy(desc(orders.createdAt))

    const stats = orderRows.reduce(
      (acc: { totalOrders: number; totalSpent: number; unpaidOrders: number }, o: (typeof orderRows)[number]) => {
        acc.totalOrders += 1
        if (o.payStatus === 'paid') acc.totalSpent += Number(o.amount || 0)
        else acc.unpaidOrders += 1
        return acc
      },
      { totalOrders: 0, totalSpent: 0, unpaidOrders: 0 },
    )

    // Attribution snapshot — prefer the visitorId this row was keyed by;
    // for named customers without one, fall back to whichever of their
    // orders has the most recent visitorId on file.
    const attributionVisitorId = visitorId || orderRows.find((o: (typeof orderRows)[number]) => o.visitorId)?.visitorId || ''
    const profileRows = attributionVisitorId
      ? await db.select().from(visitorProfiles).where(eq(visitorProfiles.visitorId, attributionVisitorId)).limit(1)
      : []

    const registeredUserRows = !isAnonymous
      ? await db.select({
          id: users.id,
          email: users.email,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
          status: users.status,
        }).from(users).where(eq(users.email, email)).limit(1)
      : []

    return {
      identity: {
        email: isAnonymous ? null : email,
        visitorId: attributionVisitorId || null,
        isAnonymous,
      },
      stats,
      profile: profileRows[0] || null,
      registeredUser: registeredUserRows[0] || null,
      orders: orderRows,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || (locale === 'zh' ? '获取客户详情失败' : 'Failed to fetch customer detail'),
    })
  }
})
