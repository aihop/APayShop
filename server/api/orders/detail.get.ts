import { orders, products } from "../../db/schema"
import { eq, and, or } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineCachedEventHandler(async (event) => {
  const orderId = getQuery(event).orderId as string
  
  if (!orderId) {
    throw createError({ statusCode: 400, message: "Missing order id" })
  }

  // Auth & Identity checks for security
  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  const visitorId = getCookie(event, 'visitor_id')

  if (!userId && !visitorId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized: No user session or visitor cookie found'
    })
  }

  // Build the condition: must match orderId AND belong to the logged-in user OR the current visitorId
  const authCondition = userId 
    ? or(eq(orders.userId, userId), eq(orders.visitorId, visitorId || ''))
    : eq(orders.visitorId, visitorId as string)

  const orderList = await db.select({
    id: orders.id,
    amount: orders.amount,
    status: orders.status,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    tradeNo: orders.tradeNo,
    payMethod: orders.payMethod,
    contactEmail: orders.contactEmail,
    deliveryInfo: orders.deliveryInfo,
    metaData: orders.metaData,
    productName: products.name,
    productImageUrl: products.imageUrl,
    productType: products.type,
    productSlug: products.slug,
  })
  .from(orders)
  .leftJoin(products, eq(orders.productId, products.id))
  .where(and(eq(orders.id, orderId), authCondition))
  .limit(1)
  
  const order = orderList[0]

  if (!order) {
    throw createError({ statusCode: 404, message: "Order not found" })
  }

  let parsedMetaData = null
  if (order.metaData) {
    try {
      parsedMetaData = typeof order.metaData === 'string' 
        ? JSON.parse(order.metaData) 
        : order.metaData
    } catch (e) {
      console.error('Failed to parse metaData JSON', e)
    }
  }

  return {
    ...order,
    metaData: parsedMetaData
  }
}, {
  maxAge: 60, // 1 minute
  swr: true,
  name: 'order-detail',
  getKey: (event) => getRouterParam(event, "orderId") || 'unknown'
})
