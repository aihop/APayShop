import { users, userTokens } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../db/runtime'
import { EMAIL_VERIFY_TOKEN_NAME } from '../../utils/auth'
import { sendEmail } from '../../utils/email'
import { getRequestLocale } from '../../utils/requestLocale'
import { getLocalizedSettingValue } from '../../utils/localizedSettings'
import { requireTrustedRequestOrigin } from '../../utils/domainLocale'

const COOLDOWN_SECONDS = 60

export default defineEventHandler(async (event) => {
  const siteUrl = requireTrustedRequestOrigin(event)
  const locale = getRequestLocale(event)
  const body = await readBody(event).catch(() => ({}))

  const messages = locale === 'zh'
    ? {
        unauthorized: '请先登录或提供注册邮箱',
        userNotFound: '未找到该邮箱对应的账号',
        alreadyVerified: '该邮箱已经通过验证，无需重复发送',
        cooldown: (sec: number) => `发送太频繁，请在 ${sec} 秒后再试`,
        sendFailed: '邮件发送失败，请稍后重试',
      }
    : {
        unauthorized: 'Please log in or provide your registered email',
        userNotFound: 'No user found with this email address',
        alreadyVerified: 'This email is already verified',
        cooldown: (sec: number) => `Please wait ${sec} seconds before requesting again`,
        sendFailed: 'Failed to send verification email. Please try again later',
      }

  // 1. 优先从 Session 获取当前登录用户，否则从 body.email 获取
  const session = await getUserSession(event).catch(() => ({ user: undefined }))
  let targetUserId = session.user?.id
  let targetEmail = (body?.email || '').trim().toLowerCase()

  let userRecord: typeof users.$inferSelect | undefined

  if (targetUserId) {
    const userRows = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1)
    userRecord = userRows[0]
  } else if (targetEmail) {
    const userRows = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1)
    userRecord = userRows[0]
  }

  if (!userRecord) {
    throw createError({
      statusCode: targetUserId || targetEmail ? 404 : 400,
      message: targetUserId || targetEmail ? messages.userNotFound : messages.unauthorized,
    })
  }

  // 2. 检查是否已经验证
  if (userRecord.emailVerifiedAt) {
    return {
      success: true,
      alreadyVerified: true,
      message: messages.alreadyVerified,
    }
  }

  // 3. 检查冷却时间（防刷邮件）
  const recentTokens = await db
    .select()
    .from(userTokens)
    .where(
      and(
        eq(userTokens.userId, userRecord.id),
        eq(userTokens.name, EMAIL_VERIFY_TOKEN_NAME),
      ),
    )
    .orderBy(desc(userTokens.createdAt))
    .limit(1)

  const latestToken = recentTokens[0]
  if (latestToken && latestToken.createdAt) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(latestToken.createdAt).getTime()) / 1000)
    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const remaining = COOLDOWN_SECONDS - elapsedSeconds
      throw createError({
        statusCode: 429,
        message: messages.cooldown(remaining),
      })
    }
  }

  // 4. 将旧的验证 token 标记失效
  if (latestToken && !latestToken.revoked) {
    await db
      .update(userTokens)
      .set({ revoked: true })
      .where(eq(userTokens.id, latestToken.id))
      .catch(() => {})
  }

  // 5. 生成新的验证 token（24 小时有效期）
  const verifyToken = crypto.randomUUID()
  const verifyExpiresAt = Math.floor(Date.now() / 1000) + 86400 // 24 hours

  await db.insert(userTokens).values({
    userId: userRecord.id,
    token: verifyToken,
    name: EMAIL_VERIFY_TOKEN_NAME,
    expiresAt: new Date(verifyExpiresAt * 1000),
    createdAt: new Date(),
  })

  const verifyLink = `${siteUrl}/api/auth/verify-email?token=${verifyToken}&lang=${locale}`
  const siteName = await getLocalizedSettingValue('site_name', locale, 'APay')

  // 6. 发送验证邮件
  const emailPromise = sendEmail({
    to: userRecord.email,
    templateCode: 'verify_email',
    locale,
    variables: {
      nickname: userRecord.nickname || userRecord.email.split('@')[0],
      site_name: siteName,
      site_url: siteUrl,
      verify_link: verifyLink,
    },
  }).catch((err) => {
    console.error('[ResendVerification] Failed to send email:', err)
  })

  if (typeof (event as any)?.waitUntil === 'function') {
    (event as any).waitUntil(emailPromise)
  }

  return {
    success: true,
    email: userRecord.email,
    cooldownSeconds: COOLDOWN_SECONDS,
  }
})
