import { orders, products } from "../../db/schema"
import { eq, desc, count } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  // Ensure the user is logged in
  const session = await requireUserSession(event)
  const userId = session.user.id

  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 10
  const offset = (page - 1) * pageSize

  const totalResult = await db.select({ value: count() }).from(orders).where(eq(orders.userId, userId))
  const total = totalResult[0]?.value || 0

  // Fetch orders associated with this user, including product details
  const userOrders = await db.select({
    id: orders.id,
    amount: orders.amount,
    status: orders.status,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    tradeNo: orders.tradeNo,
    payMethod: orders.payMethod,
    productName: products.name,
    productImageUrl: products.imageUrl,
    productType: products.type,
    deliveryInfo: orders.deliveryInfo
  })
  .from(orders)
  .leftJoin(products, eq(orders.productId, products.id))
  .where(eq(orders.userId, userId))
  .orderBy(desc(orders.createdAt))
  .limit(pageSize)
  .offset(offset)

  return {
    data: userOrders,
    total,
    page,
    pageSize
  }
})
