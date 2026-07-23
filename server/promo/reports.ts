import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../db/runtime'
import { orders, promoAgentRelations, promoCommissions, promoInviteRelations, promoMembers, promoOrderAttributions, users } from '../db/schema'
import { PROMO_COMMISSION_STATUS, PROMO_ROLE } from './utils'
import { ensurePromoMember } from './members'

export async function getPromoOverview() {
  const [membersCount, agentsCount, mastersCount, pendingCommissions, paidOrders] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(promoMembers),
    db.select({ count: sql<number>`count(*)` }).from(promoMembers).where(eq(promoMembers.role, PROMO_ROLE.AGENT)),
    db.select({ count: sql<number>`count(*)` }).from(promoMembers).where(eq(promoMembers.role, PROMO_ROLE.MASTER_AGENT)),
    db.select({ amount: sql<number>`coalesce(sum(${promoCommissions.amount}), 0)` }).from(promoCommissions)
      .where(inArray(promoCommissions.status, [PROMO_COMMISSION_STATUS.PENDING, PROMO_COMMISSION_STATUS.AVAILABLE])),
    db.select({ count: sql<number>`count(*)` }).from(promoOrderAttributions),
  ])

  return {
    members: Number(membersCount[0]?.count || 0),
    agents: Number(agentsCount[0]?.count || 0),
    masterAgents: Number(mastersCount[0]?.count || 0),
    commissionAmount: Number(pendingCommissions[0]?.amount || 0),
    attributedOrders: Number(paidOrders[0]?.count || 0),
  }
}

export async function listPromoCommissions(limit = 50) {
  return db.select().from(promoCommissions).orderBy(desc(promoCommissions.createdAt)).limit(limit)
}

export async function listPromoAgents(limit = 50) {
  return db.select({
    id: promoMembers.id,
    userId: promoMembers.userId,
    role: promoMembers.role,
    status: promoMembers.status,
    promoCode: promoMembers.promoCode,
    inviteCode: promoMembers.inviteCode,
    agentCode: promoMembers.agentCode,
    currentAgentTierId: promoMembers.currentAgentTierId,
    createdAt: promoMembers.createdAt,
    email: users.email,
    nickname: users.nickname,
  })
    .from(promoMembers)
    .innerJoin(users, eq(users.id, promoMembers.userId))
    .where(inArray(promoMembers.role, [PROMO_ROLE.AGENT, PROMO_ROLE.MASTER_AGENT]))
    .orderBy(desc(promoMembers.createdAt))
    .limit(limit)
}

export async function listPromoAttributions(limit = 50) {
  return db.select().from(promoOrderAttributions).orderBy(desc(promoOrderAttributions.createdAt)).limit(limit)
}

export async function listMasterAgentChildren(masterAgentUserId: number) {
  return db.select({
    relationId: promoAgentRelations.id,
    agentUserId: promoAgentRelations.agentUserId,
    parentAgentUserId: promoAgentRelations.parentAgentUserId,
    masterAgentUserId: promoAgentRelations.masterAgentUserId,
    boundAt: promoAgentRelations.boundAt,
    email: users.email,
    nickname: users.nickname,
  })
    .from(promoAgentRelations)
    .innerJoin(users, eq(users.id, promoAgentRelations.agentUserId))
    .where(and(
      eq(promoAgentRelations.masterAgentUserId, masterAgentUserId),
      eq(promoAgentRelations.status, 'active'),
      or(eq(promoAgentRelations.parentAgentUserId, masterAgentUserId), isNull(promoAgentRelations.parentAgentUserId)),
    ))
    .orderBy(desc(promoAgentRelations.createdAt))
}

export async function listPromoAgentRelations(limit = 100) {
  return db.select({
    relationId: promoAgentRelations.id,
    agentUserId: promoAgentRelations.agentUserId,
    agentEmail: users.email,
    agentNickname: users.nickname,
    parentAgentUserId: promoAgentRelations.parentAgentUserId,
    masterAgentUserId: promoAgentRelations.masterAgentUserId,
    depth: promoAgentRelations.depth,
    status: promoAgentRelations.status,
    boundAt: promoAgentRelations.boundAt,
    createdAt: promoAgentRelations.createdAt,
  })
    .from(promoAgentRelations)
    .innerJoin(users, eq(users.id, promoAgentRelations.agentUserId))
    .orderBy(desc(promoAgentRelations.createdAt))
    .limit(limit)
}

export async function getUserPromoOverview(userId: number) {
  const member = await ensurePromoMember(userId, PROMO_ROLE.MEMBER)
  const inviteRelationRows = await db.select({ value: sql<number>`count(*)` })
    .from(promoInviteRelations)
    .where(eq(promoInviteRelations.inviterUserId, userId))
  const agentChildrenRows = await db.select({ value: sql<number>`count(*)` })
    .from(promoAgentRelations)
    .where(and(
      eq(promoAgentRelations.masterAgentUserId, userId),
      eq(promoAgentRelations.status, 'active'),
    ))
  const pendingAgentRows = await db.select({ value: sql<number>`count(*)` })
    .from(promoAgentRelations)
    .where(and(
      eq(promoAgentRelations.masterAgentUserId, userId),
      eq(promoAgentRelations.status, 'pending'),
    ))
  const commissionRows = await db.select({
    amount: sql<number>`coalesce(sum(${promoCommissions.amount}), 0)`,
  }).from(promoCommissions).where(eq(promoCommissions.ownerUserId, userId))

  return {
    member,
    role: member?.role || PROMO_ROLE.MEMBER,
    isAgent: member?.role === PROMO_ROLE.AGENT || member?.role === PROMO_ROLE.MASTER_AGENT,
    isMasterAgent: member?.role === PROMO_ROLE.MASTER_AGENT,
    inviteCount: Number(inviteRelationRows[0]?.value || 0),
    teamCount: Number(agentChildrenRows[0]?.value || 0),
    pendingTeamCount: Number(pendingAgentRows[0]?.value || 0),
    commissionAmount: Number(commissionRows[0]?.amount || 0),
    inviteLink: member?.inviteCode ? `/auth/register?invite=${member.inviteCode}` : '',
    promoLink: member?.promoCode ? `/auth/register?promo=${member.promoCode}` : '',
    agentLink: member?.agentCode ? `/auth/register?agent=${member.agentCode}` : '',
  }
}

export async function listUserPromoInviteRelations(userId: number, limit = 50) {
  return db.select({
    relationId: promoInviteRelations.id,
    inviteeUserId: promoInviteRelations.inviteeUserId,
    inviterUserId: promoInviteRelations.inviterUserId,
    source: promoInviteRelations.source,
    codeSnapshot: promoInviteRelations.codeSnapshot,
    boundAt: promoInviteRelations.boundAt,
    email: users.email,
    nickname: users.nickname,
  })
    .from(promoInviteRelations)
    .innerJoin(users, eq(users.id, promoInviteRelations.inviteeUserId))
    .where(eq(promoInviteRelations.inviterUserId, userId))
    .orderBy(desc(promoInviteRelations.createdAt))
    .limit(limit)
}

export async function listUserPromoTeam(userId: number, limit = 50) {
  return db.select({
    relationId: promoAgentRelations.id,
    agentUserId: promoAgentRelations.agentUserId,
    parentAgentUserId: promoAgentRelations.parentAgentUserId,
    masterAgentUserId: promoAgentRelations.masterAgentUserId,
    boundAt: promoAgentRelations.boundAt,
    email: users.email,
    nickname: users.nickname,
  })
    .from(promoAgentRelations)
    .innerJoin(users, eq(users.id, promoAgentRelations.agentUserId))
    .where(and(
      eq(promoAgentRelations.masterAgentUserId, userId),
      eq(promoAgentRelations.status, 'active'),
    ))
    .orderBy(desc(promoAgentRelations.createdAt))
    .limit(limit)
}

export async function listUserPromoCommissions(userId: number, limit = 50) {
  return db.select().from(promoCommissions)
    .where(eq(promoCommissions.ownerUserId, userId))
    .orderBy(desc(promoCommissions.createdAt))
    .limit(limit)
}

export async function getMasterAgentTeamReport(masterAgentUserId: number) {
  const teamRows = await db.select({
    relationId: promoAgentRelations.id,
    agentUserId: promoAgentRelations.agentUserId,
    parentAgentUserId: promoAgentRelations.parentAgentUserId,
    masterAgentUserId: promoAgentRelations.masterAgentUserId,
    boundAt: promoAgentRelations.boundAt,
    email: users.email,
    nickname: users.nickname,
  })
    .from(promoAgentRelations)
    .innerJoin(users, eq(users.id, promoAgentRelations.agentUserId))
    .where(and(
      eq(promoAgentRelations.masterAgentUserId, masterAgentUserId),
      eq(promoAgentRelations.status, 'active'),
    ))
    .orderBy(desc(promoAgentRelations.createdAt))

  if (!teamRows.length) {
    return {
      summary: {
        teamCount: 0,
        paidOrderCount: 0,
        totalSalesAmount: 0,
        totalCommissionAmount: 0,
      },
      rows: [],
    }
  }

  const agentIds = teamRows.map((item: any) => item.agentUserId).filter(Boolean)

  const attributionRows = agentIds.length > 0
    ? await db.select({
      agentUserId: promoOrderAttributions.agentUserId,
      orderId: promoOrderAttributions.orderId,
      amount: orders.amount,
      payStatus: orders.payStatus,
    })
      .from(promoOrderAttributions)
      .innerJoin(orders, eq(orders.id, promoOrderAttributions.orderId))
      .where(inArray(promoOrderAttributions.agentUserId, agentIds as number[]))
    : []

  const commissionRows = agentIds.length > 0
    ? await db.select({
      ownerUserId: promoCommissions.ownerUserId,
      amount: promoCommissions.amount,
      status: promoCommissions.status,
    })
      .from(promoCommissions)
      .where(inArray(promoCommissions.ownerUserId, agentIds as number[]))
    : []

  const rows = teamRows.map((item: any) => {
    const agentOrders = attributionRows.filter((order: any) => order.agentUserId === item.agentUserId && order.payStatus === 'paid')
    const agentCommissions = commissionRows.filter((commission: any) => commission.ownerUserId === item.agentUserId)
    const totalSalesAmount = agentOrders.reduce((sum: number, order: any) => sum + Number(order.amount || 0), 0)
    const totalCommissionAmount = agentCommissions.reduce((sum: number, commission: any) => sum + Number(commission.amount || 0), 0)

    return {
      ...item,
      paidOrderCount: agentOrders.length,
      totalSalesAmount,
      totalCommissionAmount,
    }
  })

  return {
    summary: {
      teamCount: rows.length,
      paidOrderCount: rows.reduce((sum: number, item: any) => sum + item.paidOrderCount, 0),
      totalSalesAmount: rows.reduce((sum: number, item: any) => sum + item.totalSalesAmount, 0),
      totalCommissionAmount: rows.reduce((sum: number, item: any) => sum + item.totalCommissionAmount, 0),
    },
    rows,
  }
}

export async function listMasterAgentTeamOrders(masterAgentUserId: number, limit = 100) {
  const rows = await db.select({
    attributionId: promoOrderAttributions.id,
    orderId: promoOrderAttributions.orderId,
    buyerUserId: promoOrderAttributions.buyerUserId,
    agentUserId: promoOrderAttributions.agentUserId,
    masterAgentUserId: promoOrderAttributions.masterAgentUserId,
    sourceType: promoOrderAttributions.sourceType,
    discountRateSnapshot: promoOrderAttributions.discountRateSnapshot,
    createdAt: promoOrderAttributions.createdAt,
    amount: orders.amount,
    payStatus: orders.payStatus,
    orderStatus: orders.status,
  })
    .from(promoOrderAttributions)
    .innerJoin(orders, eq(orders.id, promoOrderAttributions.orderId))
    .where(eq(promoOrderAttributions.masterAgentUserId, masterAgentUserId))
    .orderBy(desc(promoOrderAttributions.createdAt))
    .limit(limit)

  const userIds = Array.from(new Set(
    rows.flatMap((item: any) => [item.buyerUserId, item.agentUserId]).filter(Boolean),
  ))

  const userRows = userIds.length > 0
    ? await db.select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
    }).from(users).where(inArray(users.id, userIds as number[]))
    : []

  const userMap: Map<number, any> = new Map(userRows.map((item: any) => [item.id, item]))

  return rows.map((item: any) => ({
    ...item,
    amount: Number(item.amount || 0),
    buyerEmail: userMap.get(item.buyerUserId)?.email || null,
    buyerNickname: userMap.get(item.buyerUserId)?.nickname || null,
    agentEmail: userMap.get(item.agentUserId)?.email || null,
    agentNickname: userMap.get(item.agentUserId)?.nickname || null,
  }))
}
