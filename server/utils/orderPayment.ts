import { and, eq, ne } from 'drizzle-orm'
import { orders } from '../db/schema'
import { db } from '../db/runtime'
import { getAffectedRows } from './dbResult'
import { ORDER_PAY_STATUS, ORDER_STATUS } from './constants'
import { logger } from './logger'
import { fulfillOrder } from './fulfillment'
import { dispatchEvent } from './eventBus'
import { trackVisitorEvent } from './visitorAnalytics'
import { createOrderAttribution, settlePromoCommission } from '../promo/service'
import { deliverMinimalCheckoutPaid } from '../../app/themes/minimal/server/checkout/notify'
import { readMinimalCheckoutBridgeMeta } from '../../app/themes/minimal/server/checkout/bridge'
import { fulfillMinimalCheckoutRelay } from '../../app/themes/minimal/server/checkout/fulfillment'

export type MarkOrderPaidOutcome =
  | 'paid'          // 本次调用真正完成了置为已支付 + 履约
  | 'already_paid'  // 已经是已支付(或被并发请求抢先),本次幂等返回
  | 'not_found'
  | 'amount_mismatch'

export interface MarkOrderPaidInput {
  orderId: string
  tradeNo?: string | null
  /** 网关侧金额,给了就做一致性校验 */
  amount?: number | null
  payMethod?: string | null
  /** 记日志用,区分是回调还是主动查单补偿 */
  source: string
}

export interface MarkOrderPaidResult {
  outcome: MarkOrderPaidOutcome
  order?: any
}

/**
 * 把订单置为已支付并触发履约,回调与主动查单补偿共用这一条路径。
 *
 * 单独抽出来的原因是这段有两个非常容易写错的点,复制第二份迟早会走样:
 *
 *  1. 原子抢占。网关会并发/重试推送同一笔回调,而查单补偿又可能和回调同时到达。
 *     只有条件更新(`ne(payStatus, PAID)`)真正改到行的那一个调用方才继续履约,
 *     其余幂等返回——否则会重复发卡、重复结佣、重复派发 order.paid 事件。
 *  2. 履约链的顺序与完整性:归因 → 埋点 → 发货 → 结佣 → 通知 → 事件。
 *     漏掉任何一步都会表现为"订单显示已支付但没发货/没结佣"。
 */
export const markOrderPaid = async (input: MarkOrderPaidInput): Promise<MarkOrderPaidResult> => {
  const { orderId, tradeNo, amount, payMethod, source } = input

  const found = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (found.length === 0) return { outcome: 'not_found' }
  const order = found[0]

  if (amount != null && Math.abs(order.amount - amount) > 0.01) {
    await logger.warn(`Amount mismatch for order ${order.id}`, {
      source,
      details: { expected: order.amount, got: amount },
    })
    if (tradeNo) {
      await db.update(orders).set({ tradeNo }).where(eq(orders.id, orderId))
    }
    return { outcome: 'amount_mismatch', order }
  }

  if (order.payStatus === ORDER_PAY_STATUS.PAID) {
    return { outcome: 'already_paid', order }
  }

  const paidAt = new Date()
  const updateData: any = {
    payStatus: ORDER_PAY_STATUS.PAID,
    // 先置为处理中,后续 fulfillOrder 再推进到最终状态
    status: ORDER_STATUS.PROCESSING,
    paidAt,
  }
  if (payMethod) updateData.payMethod = payMethod
  if (tradeNo) updateData.tradeNo = tradeNo

  const claim = await db.update(orders)
    .set(updateData)
    .where(and(eq(orders.id, orderId), ne(orders.payStatus, ORDER_PAY_STATUS.PAID)))

  if (getAffectedRows(claim) === 0) {
    await logger.info(`Order ${orderId} already claimed concurrently, skipping fulfillment`, {
      source,
      details: { tradeNo },
    })
    return { outcome: 'already_paid', order }
  }

  await logger.info(`Order ${orderId} paid via ${payMethod || order.payMethod || 'unknown'}`, {
    source,
    details: { tradeNo, amount },
  })

  await createOrderAttribution({
    orderId,
    buyerUserId: order.userId,
    metaData: typeof order.metaData === 'string' ? JSON.parse(order.metaData) : order.metaData,
  })

  await trackVisitorEvent(null, {
    visitorId: order.visitorId,
    userId: order.userId,
    orderId: order.id,
    productId: order.productId,
    eventName: 'order_paid',
    createdAt: paidAt,
  })

  const orderMeta = typeof order.metaData === 'string' ? JSON.parse(order.metaData) : order.metaData
  const isMinimalRelay = Boolean(readMinimalCheckoutBridgeMeta(orderMeta))
  const fulfilledOrder = isMinimalRelay
    ? await fulfillMinimalCheckoutRelay(orderId)
    : await fulfillOrder(orderId)
  if (fulfilledOrder) {
    await settlePromoCommission(orderId)
    if (isMinimalRelay) {
      await deliverMinimalCheckoutPaid(fulfilledOrder)
    } else {
      await dispatchEvent('order.paid', fulfilledOrder)
    }
  }

  return { outcome: 'paid', order: fulfilledOrder || order }
}
