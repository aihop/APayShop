import { orders } from "../../../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '../../../../db/runtime'
import { getRequestLocale } from "../../../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        invalidRequest: '请求无效',
        orderNotFound: '订单不存在',
        onlyPending: '只有待支付订单可以取消',
        cancelled: '订单已成功取消',
      }
    : {
        invalidRequest: 'Invalid request',
        orderNotFound: 'Order not found',
        onlyPending: 'Only pending orders can be cancelled',
        cancelled: 'Order cancelled successfully',
      }
  const session = await requireUserSession(event)
  const userId = session.user.id
  const orderId = event.context.params?.id

  if (!userId || !orderId) {
    throw createError({
      statusCode: 400,
      message: messages.invalidRequest
    })
  }

  // Find the order and verify it belongs to this user
  const existing = await db.select({
    id: orders.id,
    payStatus: orders.payStatus,
    status: orders.status
  })
  .from(orders)
  .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
  .limit(1)

  if (!existing || existing.length === 0) {
    throw createError({
      statusCode: 404,
      message: messages.orderNotFound
    })
  }

  const order = existing[0]

  // Only pending orders can be cancelled
  if (order.payStatus !== 'pending') {
    throw createError({
      statusCode: 400,
      message: messages.onlyPending
    })
  }

  // Update payStatus to cancelled, mark status as expired
  await db.update(orders)
    .set({
      payStatus: 'cancelled',
      status: 'expired'
    })
    .where(eq(orders.id, orderId))

  return {
    success: true,
    message: messages.cancelled
  }
})
