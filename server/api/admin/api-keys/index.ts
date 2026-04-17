import { apiKeys, users, orders, products } from "../../../db/schema"
import { eq, desc } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  if (event.method === "GET") {
    // Perform a join to get user, order, and product info
    const keys = await db.select({
      id: apiKeys.id,
      keyString: apiKeys.keyString,
      quotaLimit: apiKeys.quotaLimit,
      quotaUsed: apiKeys.quotaUsed,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt,
      orderId: apiKeys.orderId,
      productName: products.name,
      userEmail: users.email
    })
    .from(apiKeys)
    .leftJoin(products, eq(apiKeys.productId, products.id))
    .leftJoin(users, eq(apiKeys.userId, users.id))
    .orderBy(desc(apiKeys.createdAt))

    return keys
  }
})