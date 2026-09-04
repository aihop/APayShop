import { tickets, ticketMessages } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../../db/runtime'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event).catch(() => null)
  const user = session?.user as Record<string, any> | undefined
  const userId = user?.id as number | undefined

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
    throw createError({ statusCode: 404, statusMessage: '工单不存在或无权操作' })
  }

  const body = await readBody(event)
  const status = String(body.status || '').trim()

  // 用户只允许变更为 resolved 或 closed
  if (!['resolved', 'closed'].includes(status)) {
    throw createError({ statusCode: 400, statusMessage: '无效的状态变更操作' })
  }

  await db
    .update(tickets)
    .set({
      status,
      lastRepliedAt: new Date(),
      lastRepliedBy: 'user',
      updatedAt: new Date(),
    } as any)
    .where(eq(tickets.id, ticketId))

  // 插入系统提示消息
  const actionText = status === 'resolved' ? '用户已确认问题解决' : '用户主动关闭了工单'
  await db.insert(ticketMessages).values({
    ticketId,
    senderType: 'system',
    senderId: userId,
    senderName: '系统通知',
    content: actionText,
    attachments: null,
    createdAt: new Date(),
  } as any)

  return {
    code: 200,
    message: '状态更新成功',
    data: { id: ticketId, status },
  }
})
