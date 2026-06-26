import { orders } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { fulfillOrder } from '../../../utils/fulfillment'
import { dispatchEvent } from '../../../utils/eventBus'
import { ORDER_PAY_STATUS } from '../../../utils/constants'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Missing id" })
  
  const body = await readBody(event)
  
  // 1. Get current order to detect payStatus transitions
  const existing = await db.select({ payStatus: orders.payStatus }).from(orders).where(eq(orders.id, id)).limit(1)
  
  const updateData: any = {}
  if (body.status) updateData.status = body.status
  if (body.payStatus) updateData.payStatus = body.payStatus
  if (body.deliveryInfo !== undefined) updateData.deliveryInfo = body.deliveryInfo

  const result = await db.update(orders)
    .set(updateData)
    .where(eq(orders.id, id))
    .returning()
    
  // 2. If payStatus changed to 'paid', trigger fulfillment + webhook
  const wasAlreadyPaid = existing.length > 0 && existing[0].payStatus === ORDER_PAY_STATUS.PAID
  if (body.payStatus === ORDER_PAY_STATUS.PAID && !wasAlreadyPaid) {
    const fulfilledOrder = await fulfillOrder(id)
    if (fulfilledOrder) {
      dispatchEvent('order.paid', fulfilledOrder)
    }
  }
    
  return result[0]
})
