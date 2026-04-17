import { orders, products } from "../../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  const orderId = event.context.params?.id

  if (!userId || !orderId) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request'
    })
  }

  const result = await db.select({
    id: orders.id,
    amount: orders.amount,
    status: orders.status,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    tradeNo: orders.tradeNo,
    payMethod: orders.payMethod,
    contactEmail: orders.contactEmail,
    deliveryInfo: orders.deliveryInfo,
    productName: products.name,
    productImageUrl: products.imageUrl,
    productType: products.type,
    productSlug: products.slug,
  })
  .from(orders)
  .leftJoin(products, eq(orders.productId, products.id))
  .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
  .limit(1)

  if (!result || result.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Order not found'
    })
  }

  return result[0]
})
