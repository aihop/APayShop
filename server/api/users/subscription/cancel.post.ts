import { subscriptions, orders } from "../../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { sendHttpWebhook } from '../../../utils/eventBus'
import { getWebhookSubscriptionUrl, getIntegrationToken } from '../../../utils/externalProxy'
import { ORDER_STATUS } from '../../../utils/constants'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        unauthorized: '未登录',
        noActiveSubscription: '未找到有效订阅',
        cancelled: '订阅已取消',
        cancelRemark: '用户取消了订阅',
      }
    : {
        unauthorized: 'Unauthorized',
        noActiveSubscription: 'No active subscription found',
        cancelled: 'Subscription cancelled',
        cancelRemark: 'User cancelled subscription',
      }
  const session: any = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: messages.unauthorized })
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
    throw createError({ statusCode: 404, message: messages.noActiveSubscription })
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
      // 等待送达:不等待在 Serverless 下会丢投递,外部系统收不到取消同步
      const eventId = `sub:cancel:${sub.id}:${Date.now()}`
      await sendHttpWebhook(
        webhookUrl,
        {
          event: 'subscription.cancel',
          timestamp: new Date().toISOString(),
          data: {
            eventId,
            userId: Number(sub.userId),
            sourceId: sub.id,
            remark: messages.cancelRemark,
          },
        },
        { headers: { Authorization: `Bearer ${ainodeToken}` } },
      )
    }
  }

  return { success: true, message: messages.cancelled }
})
