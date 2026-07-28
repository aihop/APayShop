import { sweepPendingOrders } from '../../../utils/orderReconcile'
import { setAuditMeta } from '../../../utils/auditLog'

/**
 * 批量补偿:扫一遍仍未支付但已发起过支付的订单,逐笔向网关查单。
 *
 * 适合挂到定时任务上(后台「计划任务」里加一条指向本接口的 POST 即可),
 * 覆盖"用户付完就没再回来重试"的情况——只靠重试补偿会漏掉这一类。
 */
export default defineEventHandler(async (event) => {
  type SweepBody = { minAgeMinutes?: number; maxAgeHours?: number; limit?: number }
  // 定时任务可能不带 body,readBody 会抛,所以兜底成空对象
  const body = await readBody<SweepBody>(event).catch(() => ({} as SweepBody))

  const report = await sweepPendingOrders({
    minAgeMinutes: body?.minAgeMinutes,
    maxAgeHours: body?.maxAgeHours,
    limit: body?.limit,
  })

  setAuditMeta(event, {
    action: 'reconcile.sweep',
    resource: 'orders',
    summary: `Swept ${report.scanned} order(s), recovered ${report.paid}`,
    details: report,
  })

  return { code: 0, data: report }
})
