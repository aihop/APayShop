import { tickets, ticketMessages } from '../../../db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event).catch(() => null)
  const userId = (session?.user as any)?.id as number | undefined

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const idParam = getRouterParam(event, 'id')
  const ticketId = parseInt(idParam as string, 10)

  if (!ticketId || isNaN(ticketId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的工单 ID' })
  }

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.userId, userId)))

  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: '工单不存在或无权查看' })
  }

  const messages = await db
    .select()
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(asc(ticketMessages.createdAt))

  return {
    code: 200,
    data: {
      ticket,
      messages,
    },
  }
})
