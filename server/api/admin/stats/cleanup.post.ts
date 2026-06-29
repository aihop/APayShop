import { lt } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { visitorEvents } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ days?: number }>(event)
  const keepDays = Math.max(1, Math.min(365, body?.days ?? 90))
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000)

  const result = await db.delete(visitorEvents)
    .where(lt(visitorEvents.createdAt, cutoff))

  // Normalize the deleted count across SQLite (changes) and PG (rowCount)
  const deletedCount = (result as any)?.changes ?? (result as any)?.rowCount ?? 0

  return {
    success: true,
    deletedCount,
    keepDays,
    cutoff: cutoff.toISOString(),
  }
})
