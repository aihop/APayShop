import { retryIncompleteTopups } from '../../../utils/topupLedger'
import { setAuditMeta } from '../../../utils/auditLog'

export default defineEventHandler(async (event) => {
  const body: { limit?: number } = await readBody<{ limit?: number }>(event).catch(() => ({}))
  const report = await retryIncompleteTopups(body.limit)
  setAuditMeta(event, {
    action: 'topups.retry',
    resource: 'topups',
    summary: `Retried ${report.scanned} top-up(s), credited ${report.credited}`,
    details: report,
  })
  return { code: 0, data: report }
})
