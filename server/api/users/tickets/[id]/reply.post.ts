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

  if (ticket.status === 'closed') {
    throw createError({ statusCode: 400, statusMessage: '该工单已彻底关闭，请重新提交新工单' })
  }

  const body = await readBody(event)
  const content = String(body.content || '').trim()
  const attachments = Array.isArray(body.attachments) ? body.attachments : null

  if (!content) {
    throw createError({ statusCode: 400, statusMessage: '回复内容不能为空' })
  }

  const userName = user?.nickName || user?.nickname || user?.email || '用户'

  // 插入回复消息
  const [createdMessage] = await db
    .insert(ticketMessages)
    .values({
      ticketId,
      senderType: 'user',
      senderId: userId,
      senderName: userName,
      content,
      attachments,
      createdAt: new Date(),
    } as any)
    .returning()

  // 如果此前是已解决或自动解决，用户回复则转为处理中（重新激活）
  const newStatus = ticket.status === 'resolved' || ticket.status === 'auto_resolved' ? 'in_progress' : ticket.status

  await db
    .update(tickets)
    .set({
      status: newStatus,
      lastRepliedAt: new Date(),
      lastRepliedBy: 'user',
      updatedAt: new Date(),
    } as any)
    .where(eq(tickets.id, ticketId))

  return {
    code: 200,
    message: '回复成功',
    data: createdMessage,
  }
})
