import { subscriptions, products, users, orders } from "../../../db/schema"
import { desc, eq, inArray } from "drizzle-orm"
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  // 1. Fetch all subscriptions
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
    userNickname: users.nickname,
  })
  .from(subscriptions)
  .leftJoin(products, eq(subscriptions.productId, products.id))
  .leftJoin(users, eq(subscriptions.userId, users.id))
  .orderBy(desc(subscriptions.createdAt))

  if (!subs.length) return []

  // 2. Fetch linked orders by subscriptionId
  const subIds = subs.map(s => s.id).filter(Boolean) as string[]
  const relatedOrders = subIds.length > 0
    ? await db.select({
        id: orders.id,
        subscriptionId: orders.subscriptionId,
        contactEmail: orders.contactEmail,
      })
      .from(orders)
      .where(inArray(orders.subscriptionId, subIds))
      .orderBy(desc(orders.createdAt))
    : []

  const orderMap = new Map<string, { id: string; contactEmail: string }>()
  for (const ord of relatedOrders) {
    if (ord.subscriptionId && !orderMap.has(ord.subscriptionId)) {
      orderMap.set(ord.subscriptionId, {
        id: ord.id,
        contactEmail: ord.contactEmail,
      })
    }
  }

  // 3. Merge orderId into subscription list
  return subs.map(sub => {
    const linked = orderMap.get(sub.id)
    return {
      ...sub,
      orderId: linked?.id || sub.gatewaySubId || sub.id,
      contactEmail: linked?.contactEmail || sub.userEmail,
    }
  })
})
