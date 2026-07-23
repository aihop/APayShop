import { orders, products } from "../../db/schema"
import { eq, and, or } from "drizzle-orm"
import { db } from '../../db/runtime'

// 安全约束:订单详情含邮箱/卡密/交易号,禁止使用共享响应缓存——此前
// defineCachedEventHandler 的 getKey 读路由参数而路由实际走查询参数,
// 缓存键恒为 'unknown',60s 内跨用户返回同一份订单(高危泄露)。
export default defineEventHandler(async (event) => {
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
    payStatus: orders.payStatus,
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
})
