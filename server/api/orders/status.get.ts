import { orders, products } from "../../db/schema"
import { eq, and, or } from "drizzle-orm"
import { db } from '../../db/runtime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const orderId = query.orderId as string
  
  if (!orderId) {
    throw createError({ statusCode: 400, message: "Order ID is required" })
  }

  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  const visitorId = getCookie(event, 'visitor_id')

  if (!userId && !visitorId) {
    throw createError({ statusCode: 401, message: "Unauthorized: No user session or visitor cookie found" })
  }

  const authCondition = userId
    ? or(eq(orders.userId, userId), eq(orders.visitorId, visitorId || ''))
    : eq(orders.visitorId, visitorId as string)

  const existingOrders = await db.select({
    id: orders.id,
    amount: orders.amount,
    status: orders.status,
    payStatus: orders.payStatus,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    payMethod: orders.payMethod,
    deliveryInfo: orders.deliveryInfo,
    visitorId: orders.visitorId,
    productName: products.name,
    productType: products.type,
    productSlug: products.slug,
    productImageUrl: products.imageUrl,
  })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(and(eq(orders.id, orderId), authCondition))
    .limit(1)
  
  if (existingOrders.length === 0) {
    throw createError({ statusCode: 404, message: "Order not found" })
  }

  const order = existingOrders[0]
  
  // 敏感信息脱敏：未支付成功前，不返回发货信息
  if (order.payStatus !== 'paid') {
    order.deliveryInfo = null as any
  }

  return {
    code: 0,
    data: {
      id: order.id,
      amount: order.amount,
      status: order.status,
      payStatus: order.payStatus,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      payMethod: order.payMethod,
      deliveryInfo: order.deliveryInfo,
      productName: order.productName,
      productType: order.productType,
      productSlug: order.productSlug,
      productImageUrl: order.productImageUrl,
    }
  }
})
