import { reconcileOrder } from '../../../../utils/orderReconcile'
import { setAuditMeta } from '../../../../utils/auditLog'
import { getRequestLocale } from '../../../../utils/requestLocale'

/**
 * 手动对单笔订单向网关查单并补偿。
 * 结果完全由网关决定,接口不接受任何"支付结果"入参。
 */
export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少订单 ID' : 'Missing order id' })
  }

  const result = await reconcileOrder(id, 'admin-manual')

  setAuditMeta(event, {
    action: 'reconcile',
    resource: 'orders',
    resourceId: id,
    summary: `Reconciled order ${id} → ${result.outcome}`,
    details: result,
  })

  const messages: Record<string, { zh: string; en: string }> = {
    paid: { zh: '查到已支付，订单状态已同步并触发履约', en: 'Confirmed paid; order synced and fulfilled' },
    already_paid: { zh: '订单本地已是已支付', en: 'Order is already marked paid' },
    unpaid: { zh: '网关确认该订单尚未支付', en: 'Gateway confirms the order is unpaid' },
    closed: { zh: '该订单在网关侧已关闭或已退款', en: 'Order is closed or refunded at the gateway' },
    unsupported: { zh: '该支付方式未提供查单脚本（payments/<code>/query.js）', en: 'This method has no query.js script' },
    order_not_found: { zh: '订单不存在', en: 'Order not found' },
    method_not_found: { zh: '订单没有关联的支付方式，或该支付方式已删除', en: 'Order has no usable payment method' },
    amount_mismatch: { zh: '网关金额与订单金额不一致，未做任何变更', en: 'Amount mismatch; nothing changed' },
    error: { zh: '查单失败', en: 'Query failed' },
  }
  const m = messages[result.outcome] || messages.error!

  return {
    code: result.outcome === 'paid' || result.outcome === 'already_paid' ? 0 : 1,
    message: locale === 'zh' ? m.zh : m.en,
    data: result,
  }
})
