import { orders } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { fulfillOrder } from '../../../utils/fulfillment'
import { dispatchEvent } from '../../../utils/eventBus'
import { ORDER_PAY_STATUS } from '../../../utils/constants'
import { createOrderAttribution, settlePromoCommission } from '../../../promo/service'
import { sendMinimalCheckoutPaidNotification } from '../../../../app/themes/minimal/server/checkout/notify'
import { getRequestLocale } from '../../../utils/requestLocale'
import { setAuditMeta } from '../../../utils/auditLog'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少 ID' : 'Missing id' })
  
  const body = await readBody(event)
  
  // 1. Get current order to detect payStatus transitions
  const existing = await db.select({ status: orders.status, payStatus: orders.payStatus })
    .from(orders).where(eq(orders.id, id)).limit(1)

  const updateData: any = {}
  if (body.status) updateData.status = body.status
  if (body.payStatus) updateData.payStatus = body.payStatus
  if (body.deliveryInfo !== undefined) updateData.deliveryInfo = body.deliveryInfo

  const result = await db.update(orders)
    .set(updateData)
    .where(eq(orders.id, id))
    .returning()

  // Manually flipping an order's pay status is the single most sensitive thing
  // an admin can do here — record the transition, not just the request body.
  setAuditMeta(event, {
    summary: `Updated order ${id}`,
    details: {
      before: existing[0]
        ? { status: existing[0].status, payStatus: existing[0].payStatus }
        : null,
      after: updateData,
    },
  })


  // 2. If payStatus changed to 'paid', trigger fulfillment + webhook
  const wasAlreadyPaid = existing.length > 0 && existing[0].payStatus === ORDER_PAY_STATUS.PAID
  if (body.payStatus === ORDER_PAY_STATUS.PAID && !wasAlreadyPaid) {
    const updatedOrder = result[0]
    await createOrderAttribution({
      orderId: id,
      buyerUserId: updatedOrder?.userId,
      metaData: updatedOrder?.metaData,
    })
    const fulfilledOrder = await fulfillOrder(id)
    if (fulfilledOrder) {
      await settlePromoCommission(id)
      await sendMinimalCheckoutPaidNotification(fulfilledOrder)
      await dispatchEvent('order.paid', fulfilledOrder)
    }
  }
    
  return result[0]
})
