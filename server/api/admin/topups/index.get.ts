import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { topups, users } from '../../../db/schema'
import { BALANCE_SCALE } from '../../../utils/balance'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const status = String(query.status || '').trim()
  const listQuery = db.select({
      id: topups.id,
      orderId: topups.orderId,
      userId: topups.userId,
      userEmail: users.email,
      paymentAmount: topups.paymentAmount,
      paymentCurrency: topups.paymentCurrency,
      creditAmountCents: topups.creditAmountCents,
      creditCurrency: topups.creditCurrency,
      balanceType: topups.balanceType,
      status: topups.status,
      retryCount: topups.retryCount,
      shortfallCents: topups.shortfallCents,
      lastError: topups.lastError,
      paidAt: topups.paidAt,
      creditedAt: topups.creditedAt,
      refundedAt: topups.refundedAt,
      createdAt: topups.createdAt,
    }).from(topups).leftJoin(users, eq(users.id, topups.userId))
  const countQuery = db.select({ count: sql<number>`count(*)` }).from(topups)
  const [rows, totalRows] = status
    ? await Promise.all([
        listQuery.where(eq(topups.status, status)).orderBy(desc(topups.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
        countQuery.where(eq(topups.status, status)),
      ])
    : await Promise.all([
        listQuery.orderBy(desc(topups.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
        countQuery,
      ])
  return {
    code: 0,
    data: {
      page,
      pageSize,
      total: Number(totalRows[0]?.count || 0),
      list: rows.map((row: any) => {
        const { creditAmountCents, shortfallCents, ...rest } = row
        return {
          ...rest,
          creditAmount: Number(creditAmountCents || 0) / BALANCE_SCALE,
          shortfall: Number(shortfallCents || 0) / BALANCE_SCALE,
        }
      }),
    },
  }
})
