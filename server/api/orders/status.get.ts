import { orders } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {

  const query = getQuery(event)
  const orderId = query.orderId as string
  
  if (!orderId) {
    return createError({ statusCode: 400, message: "Order ID is required" })
  }
  const visitorId = getCookie(event, 'visitor_id')

  const existingOrders = await db.select({
    id: orders.id,
    amount: orders.amount,
    status: orders.status,
    payStatus: orders.payStatus,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    payMethod: orders.payMethod,
    deliveryInfo: orders.deliveryInfo,
    visitorId: orders.visitorId
  }).from(orders).where(eq(orders.id, orderId))
  
  if (existingOrders.length === 0) {
    return createError({ statusCode: 404, message: "Order not found" })
  }

  const order = existingOrders[0]

  if (order.visitorId !== visitorId) {
    return createError({ statusCode: 403, message: "Unauthorized: Visitor ID does not match order visitor ID" })
  }
  
  // 敏感信息脱敏：未支付成功前，不返回发货信息
  if (order.payStatus !== 'paid') {
    order.deliveryInfo = null
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
      deliveryInfo: order.deliveryInfo
    }
  }
})
