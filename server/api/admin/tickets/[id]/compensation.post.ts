import { tickets, ticketMessages, notifications } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../../../../db/runtime'
import { changeBalance, type BalanceType } from '../../../../utils/balance'

export default defineEventHandler(async (event) => {
  const admin = event.context.admin as Record<string, any> | undefined
  const adminId = admin?.id as number | undefined
  const adminUsername = admin?.username || '客服管理员'

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
  const amount = Math.abs(Number(body.amount || 0))
  const balanceType = (body.balanceType === 'cash' ? 'cash' : 'grant') as BalanceType
  const reason = String(body.reason || '工单问题核实补偿').trim()

  if (!(amount > 0)) {
    throw createError({ statusCode: 400, statusMessage: '补偿金额或点数必须大于 0' })
  }

  // 1. 生成唯一幂等键
  const eventId = `ticket-comp:${ticket.id}:${Date.now()}`

  // 2. 调用核心 changeBalance 入账并记流水
  const balanceResult = await changeBalance({
    userId: ticket.userId,
    balanceType,
    amount,
    direction: 'credit',
    eventId,
    actionType: 'admin_recharge',
    sourceType: 'admin',
    sourceId: String(ticket.id),
    operatorAdminId: adminId ?? null,
    operatorName: adminUsername,
    remark: `[工单 ${ticket.ticketNo}] ${reason}`,
  })

  const unitName = balanceType === 'grant' ? '算力点' : '元现金余额'
  const actionSummary = `管理员 ${adminUsername} 已为您发放 ${amount} ${unitName} 补偿到账（原因：${reason}）。`

  // 3. 在工单对话流中插入系统操作记录
  const [createdMessage] = await db
    .insert(ticketMessages)
    .values({
      ticketId,
      senderType: 'system',
      senderId: adminId || null,
      senderName: '系统财务通知',
      content: `💰 **财务补偿发放通知**\n${actionSummary}\n当前账户最新${unitName}: ${balanceResult.balance}`,
      attachments: null,
      createdAt: new Date(),
    } as any)
    .returning()

  // 4. 更新工单状态为处理中并记录最后更新
  await db
    .update(tickets)
    .set({
      lastRepliedAt: new Date(),
      lastRepliedBy: 'admin',
      updatedAt: new Date(),
    } as any)
    .where(eq(tickets.id, ticketId))

  // 5. 往站内信 notifications 表插入通知
  try {
    await db.insert(notifications).values({
      userId: ticket.userId,
      visitorId: null,
      type: 'balance_compensated',
      title: '账户额度补偿到账',
      message: `您的工单 ${ticket.ticketNo} 已获处理，已成功补发 ${amount} ${unitName} 到您的账户。`,
      data: {
        ticketId: ticket.id,
        ticketNo: ticket.ticketNo,
        amount,
        balanceType,
        targetPath: '/user/billing',
      },
      isRead: false,
      createdAt: new Date(),
    } as any)
  } catch (e) {
    console.error('[Compensation Notification Error]', e)
  }

  return {
    code: 200,
    message: '补偿发放成功',
    data: {
      applied: balanceResult.applied,
      newBalance: balanceResult.balance,
      balanceType,
      message: createdMessage,
    },
  }
})
