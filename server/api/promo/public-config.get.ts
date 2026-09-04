import { desc, eq, inArray } from 'drizzle-orm'
import { promoAgentTiers, settings } from '../../db/schema'
import { db } from '../../db/runtime'
import { ensureDefaultPromoTiers } from '../../promo/service'

const promoSettingKeys = [
  'promo_default_commission_rate',
  'promo_invite_reward_amount',
  'promo_access_mode',
  'promo_min_spend_amount',
]

export default defineEventHandler(async () => {
  await ensureDefaultPromoTiers().catch(() => null)

  const settingRows = await db.select().from(settings).where(inArray(settings.key, promoSettingKeys))
  const settingMap: Record<string, string> = {
    promo_default_commission_rate: '15',
    promo_access_mode: 'paid_active',
    promo_min_spend_amount: '49',
    promo_invite_reward_amount: '0',
  }
  for (const row of settingRows) {
    settingMap[row.key] = row.value
  }

  const tiers = await db.select().from(promoAgentTiers)
    .where(eq(promoAgentTiers.isActive, true))
    .orderBy(desc(promoAgentTiers.roleScope), desc(promoAgentTiers.level))

  const parsedDefaultRate = Number(settingMap.promo_default_commission_rate)
  const defaultCommissionRate = Number.isFinite(parsedDefaultRate) && parsedDefaultRate >= 0
    ? parsedDefaultRate
    : 15

  return {
    defaultCommissionRate,
    accessMode: (settingMap.promo_access_mode || 'paid_active') as 'open' | 'paid_active' | 'apply_audit' | 'paid_and_audit',
    minSpendAmount: Number(settingMap.promo_min_spend_amount) || 0,
    inviteRewardAmount: Number(settingMap.promo_invite_reward_amount) || 0,
    tiers: tiers.map(t => ({
      id: t.id,
      code: t.code,
      name: t.name,
      roleScope: t.roleScope,
      level: t.level,
      discountRate: t.discountRate,
      salesThreshold: t.salesThreshold,
      isFixed: t.isFixed,
      description: t.description,
    })),
  }
})
