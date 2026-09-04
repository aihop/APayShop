import { tickets, ticketMessages } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../../../../db/runtime'

export default defineEventHandler(async (event) => {
  const admin = event.context.admin as Record<string, any> | undefined
  const adminUsername = admin?.username || '管理员'

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
  const status = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : null
  const priority = typeof body.priority === 'string' && body.priority.trim() ? body.priority.trim() : null

  const updates: Record<string, any> = {
    updatedAt: new Date(),
  }

  const actions: string[] = []

  if (status && ['open', 'in_progress', 'auto_resolved', 'resolved', 'closed'].includes(status) && status !== ticket.status) {
    updates.status = status
    const statusLabels: Record<string, string> = {
      open: '待处理',
      in_progress: '处理中',
      auto_resolved: '已自动解决',
      resolved: '已解决',
      closed: '已关闭',
    }
    actions.push(`状态更新为「${statusLabels[status] || status}」`)
  }

  if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority) && priority !== ticket.priority) {
    updates.priority = priority
    const priorityLabels: Record<string, string> = {
      low: '低',
      normal: '普通',
      high: '高',
      urgent: '紧急',
    }
    actions.push(`优先级调整为「${priorityLabels[priority] || priority}」`)
  }

  if (Object.keys(updates).length > 1) {
    await db.update(tickets).set(updates as any).where(eq(tickets.id, ticketId))

    if (actions.length > 0) {
      await db.insert(ticketMessages).values({
        ticketId,
        senderType: 'system',
        senderId: admin?.id || null,
        senderName: '系统记录',
        content: `管理员 ${adminUsername} 将工单 ${actions.join('，')}`,
        attachments: null,
        createdAt: new Date(),
      } as any)
    }
  }

  return {
    code: 200,
    message: '更新成功',
    data: { id: ticketId, ...updates },
  }
})
