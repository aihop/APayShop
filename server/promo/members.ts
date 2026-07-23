import { eq, or } from 'drizzle-orm'
import { db } from '../db/runtime'
import { promoInviteRelations, promoMembers } from '../db/schema'
import { generatePromoCode, PROMO_CODE_LENGTH, PROMO_ROLE } from './utils'

async function generateUniqueCode(field: 'promoCode' | 'inviteCode' | 'agentCode', prefix = '') {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `${prefix}${generatePromoCode(PROMO_CODE_LENGTH)}`
    const existing = await db.select({ id: promoMembers.id })
      .from(promoMembers)
      .where(eq(promoMembers[field], code as any))
      .limit(1)
    if (!existing.length) return code
  }

  throw new Error(`Failed to generate unique ${field}`)
}

export async function ensurePromoMember(userId: number, role: string = PROMO_ROLE.MEMBER) {
  const existing = await db.select().from(promoMembers).where(eq(promoMembers.userId, userId)).limit(1)
  if (existing.length > 0) {
    const member = existing[0]
    const nextRole = role !== PROMO_ROLE.MEMBER ? role : member.role
    const shouldHaveAgentCode = nextRole === PROMO_ROLE.AGENT || nextRole === PROMO_ROLE.MASTER_AGENT
    const nextAgentCode = shouldHaveAgentCode && !member.agentCode
      ? await generateUniqueCode('agentCode', 'A')
      : member.agentCode

    if (member.role !== nextRole || member.agentCode !== nextAgentCode) {
      await db.update(promoMembers)
        .set({
          role: nextRole,
          agentCode: nextAgentCode,
          updatedAt: new Date(),
        })
        .where(eq(promoMembers.id, member.id))
      return {
        ...member,
        role: nextRole,
        agentCode: nextAgentCode,
      }
    }
    return member
  }

  const promoCode = await generateUniqueCode('promoCode', 'P')
  const inviteCode = await generateUniqueCode('inviteCode', 'I')
  const agentCode = role === PROMO_ROLE.MEMBER ? null : await generateUniqueCode('agentCode', 'A')

  const inserted = await db.insert(promoMembers).values({
    userId,
    role,
    status: 'active',
    promoCode,
    inviteCode,
    agentCode,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  return inserted[0]
}

export async function resolveInviteMemberByCode(code: string) {
  if (!code) return null

  const rows = await db.select().from(promoMembers)
    .where(or(eq(promoMembers.inviteCode, code), eq(promoMembers.promoCode, code)))
    .limit(1)

  return rows[0] || null
}

export async function resolveAgentMemberByCode(code: string) {
  if (!code) return null

  const rows = await db.select().from(promoMembers)
    .where(or(eq(promoMembers.agentCode, code), eq(promoMembers.promoCode, code)))
    .limit(1)

  return rows[0] || null
}

export async function bindInviteRelation(input: {
  inviteeUserId: number
  inviteCode?: string | null
  inviterUserId?: number | null
  source?: string
}) {
  const inviteeUserId = Number(input.inviteeUserId)
  const inviterUserId = Number(input.inviterUserId || 0) || null
  const inviteCode = String(input.inviteCode || '').trim().toUpperCase()
  if (!inviteeUserId || (!inviterUserId && !inviteCode)) return null

  const existing = await db.select().from(promoInviteRelations).where(eq(promoInviteRelations.inviteeUserId, inviteeUserId)).limit(1)
  if (existing.length > 0) return existing[0]

  let resolvedInviterUserId = inviterUserId
  if (!resolvedInviterUserId && inviteCode) {
    const inviter = await db.select({
      userId: promoMembers.userId,
    }).from(promoMembers).where(or(eq(promoMembers.inviteCode, inviteCode), eq(promoMembers.promoCode, inviteCode))).limit(1)
    resolvedInviterUserId = inviter[0]?.userId || null
  }

  if (!resolvedInviterUserId || resolvedInviterUserId === inviteeUserId) return null

  await Promise.all([
    ensurePromoMember(inviteeUserId, PROMO_ROLE.MEMBER),
    ensurePromoMember(resolvedInviterUserId, PROMO_ROLE.MEMBER),
  ])

  const inserted = await db.insert(promoInviteRelations).values({
    inviteeUserId,
    inviterUserId: resolvedInviterUserId,
    source: input.source || 'register',
    codeSnapshot: inviteCode || null,
    boundAt: new Date(),
    createdAt: new Date(),
  }).returning()

  return inserted[0]
}
