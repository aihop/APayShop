import { tickets, ticketMessages, users, userWallets, orders } from '../../../db/schema'
import { eq, asc, desc } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { fromScaled } from '../../../utils/balance'

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const ticketId = parseInt(idParam as string, 10)

  if (!ticketId || isNaN(ticketId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的工单 ID' })
  }

  const [ticket] = await db
    .select({
      id: tickets.id,
      ticketNo: tickets.ticketNo,
      userId: tickets.userId,
      userEmail: users.email,
      userNickname: users.nickname,
      category: tickets.category,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      context: tickets.context,
      lastRepliedAt: tickets.lastRepliedAt,
      lastRepliedBy: tickets.lastRepliedBy,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.userId, users.id))
    .where(eq(tickets.id, ticketId))

  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: '工单不存在' })
  }

  const [messages, walletRows, recentOrders] = await Promise.all([
    db
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(asc(ticketMessages.createdAt)),
    db
      .select()
      .from(userWallets)
      .where(eq(userWallets.userId, ticket.userId))
      .limit(1),
    ticket.userEmail
      ? db
          .select({
            id: orders.id,
            amount: orders.amount,
            currency: orders.currency,
            payStatus: orders.payStatus,
            payMethod: orders.payMethod,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(eq(orders.contactEmail, ticket.userEmail))
          .orderBy(desc(orders.createdAt))
          .limit(3)
      : Promise.resolve([]),
  ])

  const walletRow = walletRows[0]
  const userFinance = walletRow
    ? {
        cashBalance: fromScaled(walletRow.cashBalance),
        grantBalance: fromScaled(walletRow.grantBalance),
        subBalance: fromScaled(walletRow.subBalance),
        pointsBalance: fromScaled(walletRow.pointsBalance),
        tierLevel: walletRow.tierLevel,
        subExpiresAt: walletRow.subExpiresAt,
      }
    : null

  return {
    code: 200,
    data: {
      ticket,
      messages,
      userFinance,
      recentOrders,
    },
  }
})
