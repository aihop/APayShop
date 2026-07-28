import { orders } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { fulfillOrder } from '../../../utils/fulfillment'
import { dispatchEvent } from '../../../utils/eventBus'
import { ORDER_PAY_STATUS } from '../../../utils/constants'
import { createOrderAttribution, settlePromoCommission } from '../../../promo/service'
import { deliverMinimalCheckoutPaid } from '../../../../app/themes/minimal/server/checkout/notify'
import { readMinimalCheckoutBridgeMeta } from '../../../../app/themes/minimal/server/checkout/bridge'
import { fulfillMinimalCheckoutRelay } from '../../../../app/themes/minimal/server/checkout/fulfillment'
import { getRequestLocale } from '../../../utils/requestLocale'
import { setAuditMeta } from '../../../utils/auditLog'
import { clawbackTopup } from '../../../utils/balance'

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
    const isMinimalRelay = Boolean(readMinimalCheckoutBridgeMeta(updatedOrder?.metaData))
    const fulfilledOrder = isMinimalRelay
      ? await fulfillMinimalCheckoutRelay(id)
      : await fulfillOrder(id)
    if (fulfilledOrder) {
      await settlePromoCommission(id)
      if (isMinimalRelay) {
        await deliverMinimalCheckoutPaid(fulfilledOrder)
      } else {
        await dispatchEvent('order.paid', fulfilledOrder)
      }
    }
  }
    
  // 3. If payStatus changed to 'refunded', claw back the credited balance.
  //    退款只退了钱,余额里那份还在——不回收等于白送。只处理确实入过账的充值单
  //    (clawbackTopup 会核对 topup 流水存在与否),幂等键 refund:<orderId>,
  //    重复标记退款不会重复扣。
  const wasRefunded = existing.length > 0 && existing[0].payStatus === ORDER_PAY_STATUS.REFUNDED
  if (body.payStatus === ORDER_PAY_STATUS.REFUNDED && !wasRefunded) {
    const refundedOrder = result[0]
    if (refundedOrder?.userId) {
      try {
        const clawback = await clawbackTopup({
          userId: Number(refundedOrder.userId),
          orderId: id,
          remark: `订单退款回收 ${id}`,
        })
        if (clawback.shortfall > 0) {
          // 用户已经花掉了这笔余额,扣不回来的部分需要人工跟进(不制造负余额)
          console.warn(`[Balance] refund clawback short by ${clawback.shortfall} for order ${id} (user ${refundedOrder.userId})`)
        }
      } catch (error) {
        // 回收失败不能吞:订单已标退款,余额没扣回来必须让人看见
        console.error(`[Balance] failed to claw back refunded order ${id}:`, error)
        throw error
      }
    }
  }

  return result[0]
})
