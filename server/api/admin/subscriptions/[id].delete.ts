import { subscriptions, orders } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { sendHttpWebhook } from '../../../utils/eventBus'
import { getWebhookSubscriptionUrl, getIntegrationToken } from '../../../utils/externalProxy'
import { ORDER_STATUS } from '../../../utils/constants'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing subscription id' })

  // 1. Find the subscription
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1)
  if (!existing.length) {
    throw createError({ statusCode: 404, message: 'Subscription not found' })
  }

  const sub = existing[0]

  // 2. Update subscription status
  await db.update(subscriptions)
    .set({
      status: 'canceled',
      cancelAtPeriodEnd: true,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))

  // 3. Find and expire related orders (those linked to this subscriptionId)
  const relatedOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.subscriptionId, id))
  for (const order of relatedOrders) {
    await db.update(orders)
      .set({ status: ORDER_STATUS.EXPIRED })
      .where(eq(orders.id, order.id))
  }

  // 4. Send subscription.cancel to ainode
  const [webhookUrl, ainodeToken] = await Promise.all([getWebhookSubscriptionUrl(), getIntegrationToken()])
  if (webhookUrl && ainodeToken && sub.userId) {
    const eventId = `sub:cancel:${id}:${Date.now()}`
    sendHttpWebhook(
      webhookUrl,
      {
        event: 'subscription.cancel',
        timestamp: new Date().toISOString(),
        data: {
          eventId,
          userId: Number(sub.userId),
          sourceId: id,
          remark: 'Admin cancelled subscription',
        },
      },
      { headers: { Authorization: `Bearer ${ainodeToken}` } }
    )
  }

  return { code: 0, message: 'Subscription cancelled' }
})
