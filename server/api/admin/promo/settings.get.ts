import { inArray } from 'drizzle-orm'
import { settings } from '../../../db/schema'
import { db } from '../../../db/runtime'

const promoSettingKeys = [
  'promo_invite_reward_amount',
]

export default defineEventHandler(async () => {
  const rows = await db.select().from(settings).where(inArray(settings.key, promoSettingKeys))
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
})
