import { eq } from 'drizzle-orm'
import { settings } from '../../../db/schema'
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const payload = {
    promo_default_commission_rate: String(body?.promo_default_commission_rate ?? '15'),
    promo_invite_reward_amount: String(body?.promo_invite_reward_amount ?? '0'),
    promo_access_mode: String(body?.promo_access_mode || 'paid_active'),
    promo_min_spend_amount: String(body?.promo_min_spend_amount || '49'),
  }

  for (const [key, value] of Object.entries(payload)) {
    const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, key))
    } else {
      await db.insert(settings).values({ key, value })
    }
  }

  return { ok: true }
})
