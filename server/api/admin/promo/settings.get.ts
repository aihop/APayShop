import { inArray } from 'drizzle-orm'
import { settings } from '../../../db/schema'
import { db } from '../../../db/runtime'

const promoSettingKeys = [
  'promo_default_commission_rate',
  'promo_invite_reward_amount',
  'promo_access_mode',
  'promo_min_spend_amount',
]

export default defineEventHandler(async () => {
  const rows = await db.select().from(settings).where(inArray(settings.key, promoSettingKeys))
  const result: Record<string, string> = {
    promo_default_commission_rate: '15',
    promo_access_mode: 'paid_active',
    promo_min_spend_amount: '49',
    promo_invite_reward_amount: '0',
  }
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
})
