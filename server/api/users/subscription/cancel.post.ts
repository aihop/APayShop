import { subscriptions, orders } from "../../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { sendHttpWebhook } from '../../../utils/eventBus'
import { getWebhookSubscriptionUrl, getIntegrationToken } from '../../../utils/externalProxy'
import { ORDER_STATUS } from '../../../utils/constants'

export default defineEventHandler(async (event) => {
  const session: any = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const userId = session.user.id

  // Find active subscription for this user
  const existing = await db.select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, 'active'),
    ))
    .limit(1)

  if (!existing.length) {
    throw createError({ statusCode: 404, message: 'No active subscription found' })
  }

  const sub = existing[0]

  // Update subscription status
  await db.update(subscriptions)
    .set({
      status: 'canceled',
      cancelAtPeriodEnd: true,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id))

  // Expire related orders
  const relatedOrders = await db.select({ id: orders.id })
    .from(orders)
    .where(eq(orders.subscriptionId, sub.id))

  for (const order of relatedOrders) {
    await db.update(orders)
      .set({ status: ORDER_STATUS.EXPIRED })
      .where(eq(orders.id, order.id))
  }

  // Send subscription.cancel to ainode
  if (sub.userId) {
    const [webhookUrl, ainodeToken] = await Promise.all([getWebhookSubscriptionUrl(), getIntegrationToken()])
    if (webhookUrl && ainodeToken) {
      const eventId = `sub:cancel:${sub.id}:${Date.now()}`
      sendHttpWebhook(
        webhookUrl,
        {
          event: 'subscription.cancel',
          timestamp: new Date().toISOString(),
          data: {
            eventId,
            userId: Number(sub.userId),
            sourceId: sub.id,
            remark: 'User cancelled subscription',
          },
        },
        { headers: { Authorization: `Bearer ${ainodeToken}` } },
      )
    }
  }

  return { success: true, message: 'Subscription cancelled' }
})
