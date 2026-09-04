import { emailLogs } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { sendEmail } from '../../../utils/email'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const body = await readBody(event)
  const logId = Number(body?.logId)

  if (!logId || isNaN(logId)) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '缺少邮件日志 ID' : 'Missing email log id',
    })
  }

  const logs = await db.select().from(emailLogs).where(eq(emailLogs.id, logId)).limit(1)
  if (!logs.length) {
    throw createError({
      statusCode: 404,
      message: locale === 'zh' ? '邮件日志不存在' : 'Email log not found',
    })
  }

  const targetLog = logs[0]!
  if (!targetLog.to) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '收件人地址无效' : 'Invalid recipient email',
    })
  }

  const sendResult = await sendEmail({
    to: targetLog.to,
    subject: targetLog.subject || 'Notification',
    html: targetLog.html || '',
    templateCode: targetLog.templateCode || undefined,
  })

  if (!sendResult.ok) {
    throw createError({
      statusCode: 500,
      message: sendResult.error || (locale === 'zh' ? '邮件发送失败' : 'Failed to send email'),
    })
  }

  return {
    success: true,
    message: locale === 'zh' ? '邮件重新发送成功' : 'Email resent successfully',
    data: sendResult,
  }
})
