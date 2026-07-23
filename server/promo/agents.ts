import { and, desc, eq, or, sql } from 'drizzle-orm'
import { db } from '../db/runtime'
import { orders, promoAgentRelations, promoAgentTiers, promoMembers, promoOrderAttributions, users } from '../db/schema'
import { ensurePromoMember, resolveAgentMemberByCode } from './members'
import { PROMO_ROLE } from './utils'

export async function bindAgentRelation(input: {
  agentUserId: number
  parentAgentUserId?: number | null
  masterAgentUserId?: number | null
}) {
  const agentUserId = Number(input.agentUserId)
  if (!agentUserId) return null

  const existing = await db.select().from(promoAgentRelations).where(eq(promoAgentRelations.agentUserId, agentUserId)).limit(1)
  if (existing.length > 0) return existing[0]

  const parentAgentUserId = Number(input.parentAgentUserId || 0) || null
  const masterAgentUserId = Number(input.masterAgentUserId || parentAgentUserId || 0) || null

  const role = parentAgentUserId ? PROMO_ROLE.AGENT : PROMO_ROLE.MASTER_AGENT
  await ensurePromoMember(agentUserId, role)
  if (parentAgentUserId) {
    await ensurePromoMember(
      parentAgentUserId,
      masterAgentUserId === parentAgentUserId ? PROMO_ROLE.MASTER_AGENT : PROMO_ROLE.AGENT,
    )
  }

  const inserted = await db.insert(promoAgentRelations).values({
    agentUserId,
    parentAgentUserId,
    masterAgentUserId,
    depth: parentAgentUserId ? 1 : 0,
    status: 'active',
    boundAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  return inserted[0]
}

export async function requestPromoAgentJoin(input: {
  userId: number
  agentCode?: string | null
  source?: string | null
}) {
  const userId = Number(input.userId)
  const agentCode = String(input.agentCode || '').trim().toUpperCase()
  if (!userId || !agentCode) return null

  const targetAgentMember = await resolveAgentMemberByCode(agentCode)
  if (!targetAgentMember?.userId || targetAgentMember.userId === userId) return null

  const targetRelationRows = await db.select().from(promoAgentRelations)
    .where(eq(promoAgentRelations.agentUserId, targetAgentMember.userId))
    .limit(1)
  const targetRelation = targetRelationRows[0] || null

  const masterAgentUserId =
    targetAgentMember.role === PROMO_ROLE.MASTER_AGENT
      ? targetAgentMember.userId
      : Number(targetRelation?.masterAgentUserId || 0) || null

  if (!masterAgentUserId || masterAgentUserId === userId) return null

  const existingRows = await db.select().from(promoAgentRelations)
    .where(eq(promoAgentRelations.agentUserId, userId))
    .limit(1)
  const existing = existingRows[0]

  if (existing) {
    if (existing.status === 'pending' && existing.masterAgentUserId === masterAgentUserId) {
      return existing
    }
    if (existing.status === 'active') {
      return existing
    }
    await db.update(promoAgentRelations)
      .set({
        parentAgentUserId: masterAgentUserId,
        masterAgentUserId,
        depth: 1,
        status: 'pending',
        boundAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(promoAgentRelations.id, existing.id))

    const updatedRows = await db.select().from(promoAgentRelations).where(eq(promoAgentRelations.id, existing.id)).limit(1)
    return updatedRows[0] || existing
  }

  await ensurePromoMember(userId, PROMO_ROLE.MEMBER)

  const inserted = await db.insert(promoAgentRelations).values({
    agentUserId: userId,
    parentAgentUserId: masterAgentUserId,
    masterAgentUserId,
    depth: 1,
    status: 'pending',
    boundAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  return inserted[0] || null
}

export async function assignPromoAgentByUserId(input: {
  userId: number
  role: 'agent' | 'master_agent'
  parentAgentUserId?: number | null
}) {
  const userId = Number(input.userId)
  if (!userId) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }

  const userRows = await db.select({
    id: users.id,
    email: users.email,
    nickname: users.nickname,
  }).from(users).where(eq(users.id, userId)).limit(1)

  if (!userRows.length) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  if (input.role === PROMO_ROLE.MASTER_AGENT) {
    const existingMaster = await db.select({
      id: promoMembers.id,
      userId: promoMembers.userId,
    }).from(promoMembers).where(eq(promoMembers.role, PROMO_ROLE.MASTER_AGENT)).limit(1)

    if (existingMaster.length > 0 && existingMaster[0].userId !== userId) {
      throw createError({ statusCode: 400, message: 'Master agent already exists' })
    }

    const member = await ensurePromoMember(userId, PROMO_ROLE.MASTER_AGENT)
    const relation = await bindAgentRelation({
      agentUserId: userId,
      parentAgentUserId: null,
      masterAgentUserId: userId,
    })
    return { user: userRows[0], member, relation }
  }

  const parentAgentUserId = Number(input.parentAgentUserId || 0) || null
  if (!parentAgentUserId) {
    throw createError({ statusCode: 400, message: 'Parent master agent is required' })
  }

  if (parentAgentUserId === userId) {
    throw createError({ statusCode: 400, message: 'Parent master agent cannot be self' })
  }

  const parentMemberRows = await db.select({
    id: promoMembers.id,
    userId: promoMembers.userId,
    role: promoMembers.role,
  }).from(promoMembers).where(eq(promoMembers.userId, parentAgentUserId)).limit(1)

  if (!parentMemberRows.length || parentMemberRows[0].role !== PROMO_ROLE.MASTER_AGENT) {
    throw createError({ statusCode: 400, message: 'Parent master agent not found' })
  }

  const member = await ensurePromoMember(userId, PROMO_ROLE.AGENT)
  const relation = await bindAgentRelation({
    agentUserId: userId,
    parentAgentUserId,
    masterAgentUserId: parentAgentUserId,
  })

  return { user: userRows[0], member, relation }
}

export async function getActiveTier(roleScope: 'agent' | 'master_agent', salesAmount = 0) {
  const tiers = await db.select().from(promoAgentTiers)
    .where(and(eq(promoAgentTiers.roleScope, roleScope), eq(promoAgentTiers.isActive, true)))
    .orderBy(desc(promoAgentTiers.level), desc(promoAgentTiers.salesThreshold))

  if (!tiers.length) return null
  if (roleScope === PROMO_ROLE.MASTER_AGENT) {
    return tiers.find((item: any) => item.isFixed) || tiers[0]
  }

  return tiers.find((item: any) => Number(item.salesThreshold || 0) <= salesAmount) || tiers[tiers.length - 1]
}

export async function getPaidSalesAmount(agentUserId: number) {
  const result = await db.select({
    amount: sql<number>`coalesce(sum(${orders.amount}), 0)`,
  })
    .from(promoOrderAttributions)
    .innerJoin(orders, eq(orders.id, promoOrderAttributions.orderId))
    .where(and(eq(promoOrderAttributions.agentUserId, agentUserId), eq(orders.payStatus, 'paid')))

  return Number(result[0]?.amount || 0)
}

export async function updatePromoAgentRelation(input: {
  relationId: number
  parentAgentUserId: number
}) {
  const relationId = Number(input.relationId)
  const parentAgentUserId = Number(input.parentAgentUserId)

  if (!relationId || !parentAgentUserId) {
    throw createError({ statusCode: 400, message: 'Relation ID and parent master agent are required' })
  }

  const existingRows = await db.select().from(promoAgentRelations)
    .where(eq(promoAgentRelations.id, relationId))
    .limit(1)
  const existing = existingRows[0]

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Agent relation not found' })
  }

  if (existing.agentUserId === parentAgentUserId) {
    throw createError({ statusCode: 400, message: 'Parent master agent cannot be self' })
  }

  const parentRows = await db.select({
    userId: promoMembers.userId,
    role: promoMembers.role,
  }).from(promoMembers).where(eq(promoMembers.userId, parentAgentUserId)).limit(1)

  if (!parentRows.length || parentRows[0].role !== PROMO_ROLE.MASTER_AGENT) {
    throw createError({ statusCode: 400, message: 'Parent master agent not found' })
  }

  if (existing.depth === 0 && existing.agentUserId === existing.masterAgentUserId) {
    throw createError({ statusCode: 400, message: 'Master agent relation cannot be reassigned' })
  }

  await db.update(promoAgentRelations)
    .set({
      parentAgentUserId,
      masterAgentUserId: parentAgentUserId,
      depth: 1,
      status: 'active',
      boundAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(promoAgentRelations.id, relationId))

  await db.update(promoMembers)
    .set({
      role: PROMO_ROLE.AGENT,
      updatedAt: new Date(),
    })
    .where(eq(promoMembers.userId, existing.agentUserId))

  const updatedRows = await db.select().from(promoAgentRelations).where(eq(promoAgentRelations.id, relationId)).limit(1)
  return updatedRows[0]
}

export async function approvePendingPromoAgentRelation(input: {
  relationId: number
  masterAgentUserId: number
}) {
  const relationId = Number(input.relationId)
  const masterAgentUserId = Number(input.masterAgentUserId)
  if (!relationId || !masterAgentUserId) {
    throw createError({ statusCode: 400, message: 'Relation ID and master agent are required' })
  }

  const existingRows = await db.select().from(promoAgentRelations)
    .where(and(
      eq(promoAgentRelations.id, relationId),
      eq(promoAgentRelations.masterAgentUserId, masterAgentUserId),
    ))
    .limit(1)
  const existing = existingRows[0]

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Pending agent relation not found' })
  }

  if (existing.status !== 'pending') {
    throw createError({ statusCode: 400, message: 'Only pending relations can be approved' })
  }

  await ensurePromoMember(existing.agentUserId, PROMO_ROLE.AGENT)
  await db.update(promoAgentRelations)
    .set({
      parentAgentUserId: masterAgentUserId,
      masterAgentUserId,
      depth: 1,
      status: 'active',
      boundAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(promoAgentRelations.id, relationId))

  const updatedRows = await db.select().from(promoAgentRelations).where(eq(promoAgentRelations.id, relationId)).limit(1)
  return updatedRows[0]
}

export async function rejectPendingPromoAgentRelation(input: {
  relationId: number
  masterAgentUserId: number
}) {
  const relationId = Number(input.relationId)
  const masterAgentUserId = Number(input.masterAgentUserId)
  if (!relationId || !masterAgentUserId) {
    throw createError({ statusCode: 400, message: 'Relation ID and master agent are required' })
  }

  const existingRows = await db.select().from(promoAgentRelations)
    .where(and(
      eq(promoAgentRelations.id, relationId),
      eq(promoAgentRelations.masterAgentUserId, masterAgentUserId),
    ))
    .limit(1)
  const existing = existingRows[0]

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Pending agent relation not found' })
  }

  if (existing.status !== 'pending') {
    throw createError({ statusCode: 400, message: 'Only pending relations can be rejected' })
  }

  await db.update(promoAgentRelations)
    .set({
      status: 'disabled',
      updatedAt: new Date(),
    })
    .where(eq(promoAgentRelations.id, relationId))

  return { ok: true }
}

export async function disablePromoAgentRelation(relationIdInput: number) {
  const relationId = Number(relationIdInput)
  if (!relationId) {
    throw createError({ statusCode: 400, message: 'Relation ID is required' })
  }

  const existingRows = await db.select().from(promoAgentRelations)
    .where(eq(promoAgentRelations.id, relationId))
    .limit(1)
  const existing = existingRows[0]

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Agent relation not found' })
  }

  const isMasterRelation = existing.depth === 0 && existing.agentUserId === existing.masterAgentUserId
  if (isMasterRelation) {
    const childRows = await db.select({ value: sql<number>`count(*)` })
      .from(promoAgentRelations)
      .where(and(
        eq(promoAgentRelations.masterAgentUserId, existing.agentUserId),
        eq(promoAgentRelations.status, 'active'),
        sql`${promoAgentRelations.id} <> ${relationId}`,
      ))

    if (Number(childRows[0]?.value || 0) > 0) {
      throw createError({ statusCode: 400, message: 'Master agent still has active child agents' })
    }
  }

  await db.update(promoAgentRelations)
    .set({
      parentAgentUserId: null,
      masterAgentUserId: null,
      status: 'disabled',
      updatedAt: new Date(),
    })
    .where(eq(promoAgentRelations.id, relationId))

  await db.update(promoMembers)
    .set({
      role: PROMO_ROLE.MEMBER,
      currentAgentTierId: null,
      updatedAt: new Date(),
    })
    .where(eq(promoMembers.userId, existing.agentUserId))

  return { ok: true }
}

export async function listPendingPromoAgentRelations(masterAgentUserId: number, limit = 100) {
  return db.select({
    relationId: promoAgentRelations.id,
    agentUserId: promoAgentRelations.agentUserId,
    parentAgentUserId: promoAgentRelations.parentAgentUserId,
    masterAgentUserId: promoAgentRelations.masterAgentUserId,
    status: promoAgentRelations.status,
    boundAt: promoAgentRelations.boundAt,
    createdAt: promoAgentRelations.createdAt,
    email: users.email,
    nickname: users.nickname,
    promoCode: promoMembers.promoCode,
  })
    .from(promoAgentRelations)
    .innerJoin(users, eq(users.id, promoAgentRelations.agentUserId))
    .innerJoin(promoMembers, eq(promoMembers.userId, promoAgentRelations.agentUserId))
    .where(and(
      eq(promoAgentRelations.masterAgentUserId, masterAgentUserId),
      eq(promoAgentRelations.status, 'pending'),
    ))
    .orderBy(desc(promoAgentRelations.createdAt))
    .limit(limit)
}

export async function ensureDefaultPromoTiers() {
  const existing = await db.select({
    id: promoAgentTiers.id,
  }).from(promoAgentTiers).limit(1)

  if (existing.length > 0) {
    return { created: false }
  }

  await db.insert(promoAgentTiers).values([
    {
      code: 'master-default',
      name: 'Master Agent',
      roleScope: PROMO_ROLE.MASTER_AGENT,
      level: 100,
      discountRate: 0.8,
      salesThreshold: 0,
      isFixed: true,
      isActive: true,
      description: 'Fixed discount tier for master agent',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      code: 'agent-l1',
      name: 'Agent Level 1',
      roleScope: PROMO_ROLE.AGENT,
      level: 1,
      discountRate: 0.95,
      salesThreshold: 0,
      isFixed: false,
      isActive: true,
      description: 'Entry tier for child agents',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      code: 'agent-l2',
      name: 'Agent Level 2',
      roleScope: PROMO_ROLE.AGENT,
      level: 2,
      discountRate: 0.9,
      salesThreshold: 1000,
      isFixed: false,
      isActive: true,
      description: 'Advanced tier for child agents',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])

  return { created: true }
}
