import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { orders, products, promoCommissions, promoOrderAttributions, settings } from '../db/schema'
import { getActiveTier } from './agents'
import { ensurePromoMember } from './members'
import { resolveOrderCurrencyAmounts } from '../utils/orderCurrency'
import {
  firstPositiveNumber,
  normalizeJson,
  PROMO_COMMISSION_STATUS,
  PROMO_COMMISSION_TYPE,
  PROMO_ROLE,
  PROMO_SOURCE_TYPE,
  toJsonValue,
} from './utils'

async function getInviteRewardAmount() {
  const rows = await db.select().from(settings).where(eq(settings.key, 'promo_invite_reward_amount')).limit(1)
  return Number(rows[0]?.value || 0)
}

async function insertCommissionIgnoreDuplicate(values: typeof promoCommissions.$inferInsert) {
  try {
    const inserted = await db.insert(promoCommissions).values(values).returning()
    return inserted[0] || null
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase()
    if (message.includes('unique') || message.includes('duplicate')) return null
    throw error
  }
}

export async function settlePromoCommission(orderId: string) {
  const attributionRows = await db.select().from(promoOrderAttributions).where(eq(promoOrderAttributions.orderId, orderId)).limit(1)
  if (!attributionRows.length) return []

  const attribution = attributionRows[0]!
  const orderRows = await db.select({
    id: orders.id,
    amount: orders.amount,
    currency: orders.currency,
    metaData: orders.metaData,
    userId: orders.userId,
    payStatus: orders.payStatus,
    productMetaData: products.metaData,
  })
    .from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!orderRows.length || orderRows[0]!.payStatus !== 'paid') return []
  const order = orderRows[0]!
  const currencyAmounts = resolveOrderCurrencyAmounts(order)

  const existing = await db.select().from(promoCommissions).where(eq(promoCommissions.orderId, orderId))
  const created: any[] = []

  if (attribution.inviteUserId && !existing.find((item: any) => item.type === PROMO_COMMISSION_TYPE.INVITE_REWARD)) {
    const inviteReward = await getInviteRewardAmount()
    if (inviteReward > 0) {
      const ownerMember = await ensurePromoMember(attribution.inviteUserId, PROMO_ROLE.MEMBER)
      const inserted = await insertCommissionIgnoreDuplicate({
        orderId,
        ownerUserId: attribution.inviteUserId,
        ownerPromoMemberId: ownerMember.id,
        type: PROMO_COMMISSION_TYPE.INVITE_REWARD,
        sourceType: PROMO_SOURCE_TYPE.INVITE,
        amount: inviteReward,
        rate: null,
        status: PROMO_COMMISSION_STATUS.AVAILABLE,
        remark: '邀请推荐奖励',
        metaData: toJsonValue({
          buyerUserId: attribution.buyerUserId,
          currency: currencyAmounts.accountingCurrency,
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      if (inserted) created.push(inserted)
    }
  }

  if (attribution.agentUserId && !existing.find((item: any) => item.type === PROMO_COMMISSION_TYPE.AGENT_DISCOUNT)) {
    const productMeta = normalizeJson<Record<string, any>>(order.productMetaData, {})
    const baseRate = firstPositiveNumber(
      Number(attribution.discountRateSnapshot || 0),
      Number(productMeta.agent_discount_rate || 0),
    )
    if (baseRate > 0 && baseRate < 1) {
      const ownerMember = await ensurePromoMember(attribution.agentUserId, PROMO_ROLE.AGENT)
      const amount = Number((currencyAmounts.accountingAmount * (1 - baseRate)).toFixed(4))
      if (amount > 0) {
        const inserted = await insertCommissionIgnoreDuplicate({
          orderId,
          ownerUserId: attribution.agentUserId,
          ownerPromoMemberId: ownerMember.id,
          type: PROMO_COMMISSION_TYPE.AGENT_DISCOUNT,
          sourceType: PROMO_SOURCE_TYPE.AGENT,
          amount,
          rate: baseRate,
          status: PROMO_COMMISSION_STATUS.AVAILABLE,
          remark: '代理折扣收益',
          metaData: toJsonValue({
            buyerUserId: attribution.buyerUserId,
            tierId: attribution.agentTierIdSnapshot,
            tierName: attribution.agentTierNameSnapshot,
            currency: currencyAmounts.accountingCurrency,
            paymentAmount: currencyAmounts.paymentAmount,
            paymentCurrency: currencyAmounts.paymentCurrency,
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        if (inserted) created.push(inserted)
      }
    }
  }

  if (attribution.masterAgentUserId && !existing.find((item: any) => item.type === PROMO_COMMISSION_TYPE.MASTER_OVERRIDE)) {
    const masterTier = await getActiveTier(PROMO_ROLE.MASTER_AGENT)
    const productMeta = normalizeJson<Record<string, any>>(order.productMetaData, {})
    const rate = firstPositiveNumber(
      Number(masterTier?.discountRate || 0),
      Number(productMeta.master_discount_rate || 0),
    )
    if (rate > 0 && rate < 1 && attribution.masterAgentUserId !== attribution.agentUserId) {
      const ownerMember = await ensurePromoMember(attribution.masterAgentUserId, PROMO_ROLE.MASTER_AGENT)
      const amount = Number((currencyAmounts.accountingAmount * (1 - rate)).toFixed(4))
      if (amount > 0) {
        const inserted = await insertCommissionIgnoreDuplicate({
          orderId,
          ownerUserId: attribution.masterAgentUserId,
          ownerPromoMemberId: ownerMember.id,
          type: PROMO_COMMISSION_TYPE.MASTER_OVERRIDE,
          sourceType: PROMO_SOURCE_TYPE.AGENT,
          amount,
          rate,
          status: PROMO_COMMISSION_STATUS.AVAILABLE,
          remark: '总代理固定收益',
          metaData: toJsonValue({
            buyerUserId: attribution.buyerUserId,
            childAgentUserId: attribution.agentUserId,
            currency: currencyAmounts.accountingCurrency,
            paymentAmount: currencyAmounts.paymentAmount,
            paymentCurrency: currencyAmounts.paymentCurrency,
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        if (inserted) created.push(inserted)
      }
    }
  }

  return created
}
