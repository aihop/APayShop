import { and, eq, gte, lt, ne } from 'drizzle-orm'
import { orders, paymentMethods } from '../db/schema'
import { db } from '../db/runtime'
import { executeQueryScript } from './sandbox'
import { resolvePaymentScript, resolvePaymentConfig } from './paymentScripts'
import { markOrderPaid } from './orderPayment'
import { ORDER_PAY_STATUS } from './constants'
import { logger } from './logger'

export type ReconcileOutcome =
  | 'paid'            // 查到已支付,已置账并履约
  | 'already_paid'    // 本地已是已支付
  | 'unpaid'          // 网关侧确认未支付
  | 'closed'          // 已关闭/已退款,不做处理
  | 'unsupported'     // 该网关没有 query.js
  | 'order_not_found'
  | 'method_not_found'
  | 'amount_mismatch'
  | 'error'

export interface ReconcileResult {
  outcome: ReconcileOutcome
  tradeNo?: string
  message?: string
}

/**
 * 主动向网关查一次真实支付状态,查到已支付就补置账 + 履约。
 *
 * 存在的意义:回调不保证送达(网络问题、验签配置错误、服务重启),而钱已经收了。
 * 只认网关返回的状态,不接受任何调用方传入的支付结果——这是防止"伪造已支付"的
 * 关键,所以本函数不接收 amount/status 之类的入参。
 */
export const reconcileOrder = async (orderId: string, source = 'reconcile'): Promise<ReconcileResult> => {
  try {
    const found = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (found.length === 0) return { outcome: 'order_not_found' }
    const order = found[0]

    if (order.payStatus === ORDER_PAY_STATUS.PAID) return { outcome: 'already_paid' }

    // 下单失败时 payMethod 不会被写入(见 initiate.post.ts),所以这里允许调用方
    // 在订单没记录支付方式时按传入的方式查——但仍以订单上的记录优先。
    const code = String(order.payMethod || '').trim()
    if (!code || code === 'none') return { outcome: 'method_not_found' }

    const methodRows = await db.select().from(paymentMethods).where(eq(paymentMethods.code, code)).limit(1)
    if (methodRows.length === 0) return { outcome: 'method_not_found' }
    const method = methodRows[0]

    const { script } = resolvePaymentScript('query', method)
    if (!script) return { outcome: 'unsupported' }

    const config = resolvePaymentConfig(method)

    const result = await executeQueryScript(script, {
      order: {
        id: order.id,
        amount: order.amount,
        currency: (order as any).currency,
        tradeNo: order.tradeNo,
      },
    }, config)

    if (!result.ok) {
      await logger.warn(`Order ${orderId} reconcile query failed`, {
        source,
        details: { method: code, message: result.message },
      })
      return { outcome: 'error', message: result.message }
    }

    if (result.status === 'paid') {
      const marked = await markOrderPaid({
        orderId,
        tradeNo: result.tradeNo,
        amount: result.amount,
        payMethod: code,
        source,
      })
      if (marked.outcome === 'amount_mismatch') return { outcome: 'amount_mismatch', tradeNo: result.tradeNo }
      if (marked.outcome === 'already_paid') return { outcome: 'already_paid', tradeNo: result.tradeNo }
      if (marked.outcome === 'not_found') return { outcome: 'order_not_found' }
      return { outcome: 'paid', tradeNo: result.tradeNo }
    }

    if (result.status === 'closed') return { outcome: 'closed' }
    return { outcome: 'unpaid' }
  } catch (error: any) {
    await logger.error(`Order ${orderId} reconcile threw`, {
      source,
      details: { message: String(error?.message || error) },
    })
    return { outcome: 'error', message: String(error?.message || error) }
  }
}

export interface SweepOptions {
  /** 只处理创建时间早于「现在 - minAgeMinutes」的订单,避免和正常回调抢 */
  minAgeMinutes?: number
  /** 不回溯超过这个时长的订单(网关一般也查不到太久以前的单) */
  maxAgeHours?: number
  limit?: number
}

export interface SweepReport {
  scanned: number
  paid: number
  unpaid: number
  closed: number
  skipped: number
  errors: number
  paidOrderIds: string[]
}

/**
 * 批量补偿:扫描仍处于未支付、但已经发起过支付(有 payMethod)的订单,逐笔查单。
 * 覆盖"用户付完就再也没回来重试"的情况——只靠重试时补偿是不够的。
 */
export const sweepPendingOrders = async (options: SweepOptions = {}): Promise<SweepReport> => {
  const minAgeMinutes = Math.max(1, options.minAgeMinutes ?? 5)
  const maxAgeHours = Math.max(1, options.maxAgeHours ?? 72)
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200)

  const now = Date.now()
  const notNewerThan = new Date(now - minAgeMinutes * 60_000)
  const notOlderThan = new Date(now - maxAgeHours * 3_600_000)

  const candidates = await db.select({ id: orders.id })
    .from(orders)
    .where(and(
      ne(orders.payStatus, ORDER_PAY_STATUS.PAID),
      lt(orders.createdAt, notNewerThan),
      gte(orders.createdAt, notOlderThan),
    ))
    .limit(limit)

  const report: SweepReport = { scanned: 0, paid: 0, unpaid: 0, closed: 0, skipped: 0, errors: 0, paidOrderIds: [] }

  for (const row of candidates) {
    report.scanned++
    const res = await reconcileOrder(row.id, 'reconcile-sweep')
    switch (res.outcome) {
      case 'paid': report.paid++; report.paidOrderIds.push(row.id); break
      case 'unpaid': report.unpaid++; break
      case 'closed': report.closed++; break
      case 'error': case 'amount_mismatch': report.errors++; break
      default: report.skipped++; break
    }
  }

  if (report.paid > 0) {
    await logger.info(`Reconcile sweep recovered ${report.paid} paid order(s)`, {
      source: 'reconcile-sweep',
      details: report,
    })
  }

  return report
}
