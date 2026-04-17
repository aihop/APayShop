import { subscriptions, products, users } from "../../../db/schema"
import { desc, eq, sql } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  // Fetch all active subscriptions
  const subs = await db.select({
    id: subscriptions.id,
    gatewaySubId: subscriptions.gatewaySubId,
    amount: subscriptions.amount,
    currency: subscriptions.currency,
    interval: subscriptions.interval,
    intervalCount: subscriptions.intervalCount,
    status: subscriptions.status,
    payMethod: subscriptions.payMethod,
    createdAt: subscriptions.createdAt,
    currentPeriodStart: subscriptions.currentPeriodStart,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    productId: products.id,
    productName: products.name,
    userId: users.id,
    userEmail: users.email,
    userNickname: users.nickname
  })
  .from(subscriptions)
  .leftJoin(products, eq(subscriptions.productId, products.id))
  .leftJoin(users, eq(subscriptions.userId, users.id))
  .orderBy(desc(subscriptions.createdAt))

  return subs
})
