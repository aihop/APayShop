import { orders } from "../../../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '../../../../db/runtime'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  const orderId = event.context.params?.id

  if (!userId || !orderId) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request'
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
      message: 'Order not found'
    })
  }

  const order = existing[0]

  // Only pending orders can be cancelled
  if (order.payStatus !== 'pending') {
    throw createError({
      statusCode: 400,
      message: 'Only pending orders can be cancelled'
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
    message: 'Order cancelled successfully'
  }
})
