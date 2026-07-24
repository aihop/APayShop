import { orders } from "../../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from "../../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        invalidRequest: '请求无效',
        orderNotFound: '订单不存在',
        onlyCancelled: '只有已取消订单可以删除',
        deleted: '订单已成功删除',
      }
    : {
        invalidRequest: 'Invalid request',
        orderNotFound: 'Order not found',
        onlyCancelled: 'Only cancelled orders can be deleted',
        deleted: 'Order deleted successfully',
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
    payStatus: orders.payStatus
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

  // Only cancelled orders can be soft-deleted
  if (order.payStatus !== 'cancelled') {
    throw createError({
      statusCode: 400,
      message: messages.onlyCancelled
    })
  }

  // Soft delete: mark as deleted instead of physical delete (avoids FK constraints)
  await db.update(orders)
    .set({ payStatus: 'deleted' })
    .where(eq(orders.id, orderId))

  return {
    success: true,
    message: messages.deleted
  }
})
