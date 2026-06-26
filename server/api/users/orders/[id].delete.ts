import { orders } from "../../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '../../../db/runtime'

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
    payStatus: orders.payStatus
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

  // Only cancelled orders can be soft-deleted
  if (order.payStatus !== 'cancelled') {
    throw createError({
      statusCode: 400,
      message: 'Only cancelled orders can be deleted'
    })
  }

  // Soft delete: mark as deleted instead of physical delete (avoids FK constraints)
  await db.update(orders)
    .set({ payStatus: 'deleted' })
    .where(eq(orders.id, orderId))

  return {
    success: true,
    message: 'Order deleted successfully'
  }
})
