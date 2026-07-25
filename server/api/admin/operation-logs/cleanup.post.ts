import { lt } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { operationLogs } from '../../../db/schema'
import { setAuditMeta } from '../../../utils/auditLog'

// Retention prune only — deliberately no "clear all" counterpart. An audit
// trail that the audited party can wipe on demand isn't an audit trail, so the
// minimum retention here is enforced server-side and the prune itself is
// recorded (by the audit plugin, via the meta below).
const MIN_KEEP_DAYS = 30
const MAX_KEEP_DAYS = 730

export default defineEventHandler(async (event) => {
  const body = await readBody<{ days?: number }>(event)
  const keepDays = Math.max(MIN_KEEP_DAYS, Math.min(MAX_KEEP_DAYS, body?.days ?? 180))
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000)

  const result = await db.delete(operationLogs)
    .where(lt(operationLogs.createdAt, cutoff))

  // Normalize the deleted count across SQLite (changes) and PG (rowCount)
  const deletedCount = (result as any)?.changes ?? (result as any)?.rowCount ?? 0

  setAuditMeta(event, {
    action: 'cleanup',
    resource: 'operation-logs',
    summary: `Pruned ${deletedCount} operation log(s) older than ${keepDays} days`,
    details: { keepDays, cutoff: cutoff.toISOString(), deletedCount },
  })

  return {
    success: true,
    deletedCount,
    keepDays,
    cutoff: cutoff.toISOString(),
  }
})
