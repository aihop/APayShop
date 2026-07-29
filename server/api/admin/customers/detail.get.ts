import { orders, products, users, visitorProfiles } from "../../../db/schema"
import { eq, and, or, desc, isNull, sql } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { aggregateOrderAccountingTotals } from '../../../utils/orderCurrency'
import type { OrderCurrencyInput } from '../../../utils/orderCurrency'

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
      metaData: orders.metaData,
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

    const typedOrderRows = orderRows as Array<OrderCurrencyInput & Record<string, unknown> & { payStatus: string, visitorId: string | null }>
    const paidOrders = typedOrderRows.filter(order => order.payStatus === 'paid')
    const totalSpentByCurrency = aggregateOrderAccountingTotals(paidOrders)
    const stats = {
      totalOrders: typedOrderRows.length,
      totalSpent: totalSpentByCurrency.length === 1 ? (totalSpentByCurrency[0]?.amount || 0) : 0,
      totalSpentByCurrency,
      unpaidOrders: typedOrderRows.length - paidOrders.length,
    }

    // Attribution snapshot — prefer the visitorId this row was keyed by;
    // for named customers without one, fall back to whichever of their
    // orders has the most recent visitorId on file.
    const attributionVisitorId = visitorId || typedOrderRows.find(order => order.visitorId)?.visitorId || ''
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
    const responseOrders = typedOrderRows.map(({ metaData: _metaData, ...order }) => order)

    return {
      identity: {
        email: isAnonymous ? null : email,
        visitorId: attributionVisitorId || null,
        isAnonymous,
      },
      stats,
      profile: profileRows[0] || null,
      registeredUser: registeredUserRows[0] || null,
      orders: responseOrders,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || (locale === 'zh' ? '获取客户详情失败' : 'Failed to fetch customer detail'),
    })
  }
})
