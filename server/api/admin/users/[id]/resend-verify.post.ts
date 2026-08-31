import { users, userTokens } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../../../../db/runtime'
import { EMAIL_VERIFY_TOKEN_NAME } from '../../../../utils/auth'
import { sendEmail } from '../../../../utils/email'
import { getRequestLocale } from '../../../../utils/requestLocale'
import { getLocalizedSettingValue } from '../../../../utils/localizedSettings'
import { requireTrustedRequestOrigin } from '../../../../utils/domainLocale'

export default defineEventHandler(async (event) => {
  const siteUrl = requireTrustedRequestOrigin(event)
  const locale = getRequestLocale(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '用户 ID 不能为空' : 'User ID is required' })
  }
  const userId = Number(id)

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const user = userRows[0]
  if (!user) {
    throw createError({ statusCode: 404, message: locale === 'zh' ? '用户不存在' : 'User not found' })
  }

  // 生成新的验证 Token
  const verifyToken = crypto.randomUUID()
  const verifyExpiresAt = Math.floor(Date.now() / 1000) + 86400 // 24 hours

  await db.insert(userTokens).values({
    userId: user.id,
    token: verifyToken,
    name: EMAIL_VERIFY_TOKEN_NAME,
    expiresAt: new Date(verifyExpiresAt * 1000),
    createdAt: new Date(),
  })

  const verifyLink = `${siteUrl}/api/auth/verify-email?token=${verifyToken}`
  const siteName = await getLocalizedSettingValue('site_name', locale, 'APay')

  const emailPromise = sendEmail({
    to: user.email,
    templateCode: 'verify_email',
    locale,
    variables: {
      nickname: user.nickname || user.email.split('@')[0],
      site_name: siteName,
      site_url: siteUrl,
      verify_link: verifyLink,
    },
  }).catch((err) => {
    console.error('[AdminResendVerify] Failed to send email:', err)
  })

  if (typeof (event as any)?.waitUntil === 'function') {
    (event as any).waitUntil(emailPromise)
  }

  return {
    success: true,
    message: locale === 'zh' ? '验证邮件已重新发送给用户' : 'Verification email sent to user',
  }
})
