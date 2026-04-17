import { cards, products } from "../../../db/schema"
import { desc, eq, count } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 15
  const offset = (page - 1) * pageSize

  // Get total count
  const totalResult = await db.select({ value: count() }).from(cards)
  const total = totalResult[0]?.value || 0

  // Join cards with products to get product name
  const result = await db.select({
    id: cards.id,
    productId: cards.productId,
    productName: products.name,
    cardNumber: cards.cardNumber,
    isUsed: cards.isUsed,
    orderId: cards.orderId,
    createdAt: cards.createdAt
  })
  .from(cards)
  .leftJoin(products, eq(cards.productId, products.id))
  .orderBy(desc(cards.createdAt))
  .limit(pageSize)
  .offset(offset)

  return {
    data: result,
    total,
    page,
    pageSize
  }
})
