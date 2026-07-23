import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { promoAgentRelations, promoInviteRelations, promoMembers, promoOrderAttributions } from '../db/schema'
import { getActiveTier, getPaidSalesAmount } from './agents'
import { ensurePromoMember, resolveAgentMemberByCode, resolveInviteMemberByCode } from './members'
import { PROMO_ROLE, PROMO_SOURCE_TYPE, toJsonValue } from './utils'

export async function createOrderAttribution(input: {
  orderId: string
  buyerUserId?: number | null
  metaData?: Record<string, any> | null
}) {
  const orderId = String(input.orderId || '').trim()
  if (!orderId) return null

  const existing = await db.select().from(promoOrderAttributions).where(eq(promoOrderAttributions.orderId, orderId)).limit(1)
  if (existing.length > 0) return existing[0]

  const buyerUserId = Number(input.buyerUserId || 0) || null
  const normalizedMeta = input.metaData || {}
  const inviteCode = String(normalizedMeta.inviteCode || normalizedMeta.promoCode || '').trim().toUpperCase()
  const agentCode = String(normalizedMeta.agentCode || '').trim().toUpperCase()

  let buyerMember: any = null
  let inviteMember: any = null
  let agentMember: any = null
  let parentAgentRelation: any = null

  if (buyerUserId) {
    buyerMember = await ensurePromoMember(buyerUserId, PROMO_ROLE.MEMBER)

    const inviteRelation = await db.select().from(promoInviteRelations)
      .where(eq(promoInviteRelations.inviteeUserId, buyerUserId))
      .limit(1)
    if (inviteRelation.length > 0) {
      const inviter = await db.select().from(promoMembers).where(eq(promoMembers.userId, inviteRelation[0].inviterUserId)).limit(1)
      inviteMember = inviter[0] || null
    } else if (inviteCode) {
      inviteMember = await resolveInviteMemberByCode(inviteCode)
    }

    const agentRelation = await db.select().from(promoAgentRelations)
      .where(eq(promoAgentRelations.agentUserId, buyerUserId))
      .limit(1)
    if (agentRelation.length > 0 && agentRelation[0].status === 'active') {
      parentAgentRelation = agentRelation[0]
      const agentRows = await db.select().from(promoMembers).where(eq(promoMembers.userId, buyerUserId)).limit(1)
      agentMember = agentRows[0] || null
    } else if (agentCode) {
      agentMember = await resolveAgentMemberByCode(agentCode)
      if (agentMember) {
        parentAgentRelation = (await db.select().from(promoAgentRelations)
          .where(eq(promoAgentRelations.agentUserId, agentMember.userId))
          .limit(1))[0] || null
      }
    }
  } else {
    if (inviteCode) {
      inviteMember = await resolveInviteMemberByCode(inviteCode)
    }
    if (agentCode) {
      agentMember = await resolveAgentMemberByCode(agentCode)
      if (agentMember) {
        parentAgentRelation = (await db.select().from(promoAgentRelations)
          .where(eq(promoAgentRelations.agentUserId, agentMember.userId))
          .limit(1))[0] || null
      }
    }
  }

  let tierSnapshot: any = null
  if (agentMember?.userId) {
    const salesAmount = await getPaidSalesAmount(agentMember.userId)
    tierSnapshot = await getActiveTier(PROMO_ROLE.AGENT, salesAmount)
    if (tierSnapshot) {
      await db.update(promoMembers)
        .set({ currentAgentTierId: tierSnapshot.id, updatedAt: new Date() })
        .where(eq(promoMembers.userId, agentMember.userId))
    }
  }

  const sourceType =
    inviteMember?.userId && agentMember?.userId
      ? PROMO_SOURCE_TYPE.MIXED
      : agentMember?.userId
        ? PROMO_SOURCE_TYPE.AGENT
        : inviteMember?.userId
          ? PROMO_SOURCE_TYPE.INVITE
          : PROMO_SOURCE_TYPE.DIRECT

  const inserted = await db.insert(promoOrderAttributions).values({
    orderId,
    buyerUserId,
    buyerPromoMemberId: buyerMember?.id || null,
    inviteUserId: inviteMember?.userId || null,
    agentUserId: agentMember?.userId || null,
    parentAgentUserId: parentAgentRelation?.parentAgentUserId || null,
    masterAgentUserId: parentAgentRelation?.masterAgentUserId || null,
    agentTierIdSnapshot: tierSnapshot?.id || null,
    agentTierNameSnapshot: tierSnapshot?.name || null,
    discountRateSnapshot: tierSnapshot?.discountRate || null,
    sourceType,
    metaData: toJsonValue({
      inviteCode: inviteMember?.inviteCode || inviteCode || null,
      agentCode: agentMember?.agentCode || agentCode || null,
    }),
    createdAt: new Date(),
  }).returning()

  return inserted[0]
}
