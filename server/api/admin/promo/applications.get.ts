import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { orders, promoApplications, users } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const [totalRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(promoApplications),
    db.select({
      id: promoApplications.id,
      userId: promoApplications.userId,
      status: promoApplications.status,
      channelInfo: promoApplications.channelInfo,
      contact: promoApplications.contact,
      reason: promoApplications.reason,
      reviewNote: promoApplications.reviewNote,
      reviewedByAdminId: promoApplications.reviewedByAdminId,
      reviewedAt: promoApplications.reviewedAt,
      createdAt: promoApplications.createdAt,
      userEmail: users.email,
      userNickname: users.nickname,
    })
      .from(promoApplications)
      .innerJoin(users, eq(users.id, promoApplications.userId))
      .orderBy(desc(promoApplications.createdAt))
      .limit(pageSize)
      .offset(offset),
  ])

  return {
    list: rows,
    total: Number(totalRows[0]?.count || 0),
    page,
    pageSize,
  }
})
