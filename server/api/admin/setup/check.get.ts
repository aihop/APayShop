import { admins } from "../../../db/schema"
import { db } from '../../../db/runtime'
import { checkIpRateLimit, resolveClientIp } from '../../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const ip = resolveClientIp(event)
  const rl = checkIpRateLimit(`admin-setup:check:${ip}`, { max: 60, windowMs: 60_000 })
  if (!rl.ok) {
    event.node.res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000))
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', message: 'Rate limited' })
  }

  const existing = await db.select({ id: (admins as any).id }).from(admins).limit(1)
  return {
    initialized: existing.length > 0,
  }
})
