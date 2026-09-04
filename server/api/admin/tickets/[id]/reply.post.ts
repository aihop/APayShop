import { tickets, ticketMessages, notifications } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../../../../db/runtime'

export default defineEventHandler(async (event) => {
  const admin = event.context.admin as Record<string, any> | undefined
  const adminId = admin?.id as number | undefined
  const adminUsername = admin?.username || '客服专家'

  const idParam = getRouterParam(event, 'id')
  const ticketId = parseInt(idParam as string, 10)

  if (!ticketId || isNaN(ticketId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的工单 ID' })
  }

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, ticketId))

  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: '工单不存在' })
  }

  const body = await readBody(event)
  const content = String(body.content || '').trim()
  const attachments = Array.isArray(body.attachments) ? body.attachments : null
  const statusAfterReply = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : null

  if (!content) {
    throw createError({ statusCode: 400, statusMessage: '回复内容不能为空' })
  }

  // 1. 插入管理员回复消息
  const [createdMessage] = await db
    .insert(ticketMessages)
    .values({
      ticketId,
      senderType: 'admin',
      senderId: adminId || null,
      senderName: adminUsername,
      content,
      attachments,
      createdAt: new Date(),
    } as any)
    .returning()

  // 2. 更新工单状态
  let targetStatus = ticket.status
  if (statusAfterReply && ['in_progress', 'resolved', 'closed'].includes(statusAfterReply)) {
    targetStatus = statusAfterReply
  } else if (ticket.status === 'open') {
    targetStatus = 'in_progress'
  }

  await db
    .update(tickets)
    .set({
      status: targetStatus,
      lastRepliedAt: new Date(),
      lastRepliedBy: 'admin',
      updatedAt: new Date(),
    } as any)
    .where(eq(tickets.id, ticketId))

  // 3. 联动站内信通知：向提单用户发送通知
  if (ticket.userId) {
    try {
      await db.insert(notifications).values({
        userId: ticket.userId,
        visitorId: null,
        type: 'ticket_replied',
        title: '工单收到新回复',
        message: `您的工单 ${ticket.ticketNo}（${ticket.title}）已收到客服专员的回复，请前往工单中心查看。`,
        data: {
          ticketId: ticket.id,
          ticketNo: ticket.ticketNo,
          targetPath: '/user/tickets',
        },
        isRead: false,
        createdAt: new Date(),
      } as any)
    } catch (e) {
      console.error('[Ticket Notification Error]', e)
    }
  }

  return {
    code: 200,
    message: '回复成功',
    data: createdMessage,
  }
})
