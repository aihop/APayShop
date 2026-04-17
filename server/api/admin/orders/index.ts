import { orders, products, users } from "../../../db/schema"
import { eq, desc, count } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  if (event.method === "GET") {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const pageSize = parseInt(query.pageSize as string) || 15
    const offset = (page - 1) * pageSize

    // Get total count
    const totalResult = await db.select({ value: count() }).from(orders)
    const total = totalResult[0]?.value || 0

    const result = await db.select({
      id: orders.id,
      amount: orders.amount,
      status: orders.status,
      payStatus: orders.payStatus,
      contactEmail: orders.contactEmail,
      payMethod: orders.payMethod,
      tradeNo: orders.tradeNo,
      visitorId: orders.visitorId,
      createdAt: orders.createdAt,
      productName: products.name,
      productSlug: products.slug,
      productId: products.id,
      productImage: products.imageUrl,
      productType: products.type,
      userNickname: users.nickname,
      userEmail: users.email
    })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .leftJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset(offset)
    
    return {
      data: result,
      total,
      page,
      pageSize
    }
  }
})
