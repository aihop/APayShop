import { tickets, ticketMessages } from '../../../db/schema'
import { db } from '../../../db/runtime'
import { diagnoseTicketIssue } from '../../../utils/ticketBot'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event).catch(() => null)
  const user = session?.user as Record<string, any> | undefined
  const userId = user?.id as number | undefined

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const title = String(body.title || '').trim()
  const content = String(body.content || '').trim()
  const category = String(body.category || 'other').trim()
  const priority = String(body.priority || 'normal').trim()
  const context = body.context && typeof body.context === 'object' ? body.context : null
  const attachments = Array.isArray(body.attachments) ? body.attachments : null

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: '工单标题不能为空' })
  }
  if (!content) {
    throw createError({ statusCode: 400, statusMessage: '工单内容描述不能为空' })
  }

  // 生成唯一工单号 TK-YYYYMMDD-随机4位
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const ticketNo = `TK-${dateStr}-${randomSuffix}`

  // 运行智能自愈诊断
  const diagnosis = diagnoseTicketIssue({
    category,
    title,
    content,
    context,
  })

  const initialStatus = diagnosis.matched && diagnosis.suggestAutoResolved ? 'auto_resolved' : 'open'
  const finalPriority = diagnosis.suggestPriority || priority
  const lastRepliedBy = diagnosis.matched ? 'bot' : 'user'
  const userName = user?.nickName || user?.nickname || user?.email || '用户'

  // 创建工单记录
  const [createdTicket] = await db
    .insert(tickets)
    .values({
      ticketNo,
      userId,
      category,
      title,
      status: initialStatus,
      priority: finalPriority,
      context,
      lastRepliedAt: new Date(),
      lastRepliedBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning()

  const ticketId = createdTicket?.id

  // 插入用户第一条提单描述消息
  await db.insert(ticketMessages).values({
    ticketId,
    senderType: 'user',
    senderId: userId,
    senderName: userName,
    content,
    attachments,
    createdAt: new Date(),
  } as any)

  // 如果机器人匹配到诊断回复，自动插入回复消息
  if (diagnosis.matched && diagnosis.botReply) {
    await db.insert(ticketMessages).values({
      ticketId,
      senderType: 'bot',
      senderId: null,
      senderName: '轻铺AI 智能诊断助手',
      content: diagnosis.botReply,
      attachments: null,
      createdAt: new Date(Date.now() + 1000), // 稍晚1秒体现先后次序
    } as any)
  }

  return {
    code: 200,
    message: '工单提交成功',
    data: {
      ...createdTicket,
      autoDiagnosed: diagnosis.matched,
    },
  }
})
