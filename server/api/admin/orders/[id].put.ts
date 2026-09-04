import { orders } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { fulfillOrder } from '../../../utils/fulfillment'
import { emitEvent } from '../../../utils/eventActions'
import { ORDER_PAY_STATUS } from '../../../utils/constants'
import { createOrderAttribution, settlePromoCommission, cancelPromoCommission } from '../../../promo/service'
import { fulfillMinimalCheckoutRelay, readMinimalCheckoutBridgeMeta, isMinimalCheckoutRelayOrder } from '../../../utils/checkoutBridge'
import { getRequestLocale } from '../../../utils/requestLocale'
import { setAuditMeta } from '../../../utils/auditLog'
import { refundTopup, settlePaidTopup } from '../../../utils/topupLedger'
import { recoverCreditedApayTopup } from '../../../utils/apayTopupFulfillment'

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
  if (body.payStatus === ORDER_PAY_STATUS.PAID) {
    const updatedOrder = result[0]
    const isMinimalRelay = isMinimalCheckoutRelayOrder(updatedOrder)
    const isApayTopup = readMinimalCheckoutBridgeMeta(updatedOrder?.metaData)?.attach?.walletOwner === 'apay'
    if (!wasAlreadyPaid) {
      await createOrderAttribution({
        orderId: id,
        buyerUserId: updatedOrder?.userId,
        metaData: updatedOrder?.metaData,
      })
    }
    if (isApayTopup) {
      await settlePaidTopup(id)
      await recoverCreditedApayTopup(id)
    } else if (!wasAlreadyPaid) {
      const fulfilledOrder = isMinimalRelay ? await fulfillMinimalCheckoutRelay(id) : await fulfillOrder(id)
      if (fulfilledOrder) {
        await settlePromoCommission(id)
        await emitEvent('order.paid', fulfilledOrder)
      }
    }
  }
    
  // 3. If payStatus changed to 'refunded' or 'cancelled', cancel promo commissions & claw back credited balance.
  //    退款只退了钱,佣金与余额里那份如果不回收等于白送。
  if (body.payStatus === ORDER_PAY_STATUS.REFUNDED || body.payStatus === ORDER_PAY_STATUS.CANCELLED) {
    const refundedOrder = result[0]
    await cancelPromoCommission(id, `admin_${body.payStatus}`)
    if (body.payStatus === ORDER_PAY_STATUS.REFUNDED && refundedOrder?.userId) {
      try {
        const clawback = await refundTopup(id)
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
