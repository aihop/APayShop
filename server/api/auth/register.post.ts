import { users, orders, userTokens } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { emitEvent } from "../../utils/eventActions"
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"
import { sendEmail } from "../../utils/email"
import { EMAIL_VERIFY_TOKEN_NAME } from "../../utils/auth"
import { issueWebSession } from '../../utils/userSessions'
import { bindInviteRelation, capturePromoTracking, ensurePromoMember, mergePromoTracking, readPromoTracking, requestPromoAgentJoin } from "../../promo/service"
import { getRequestLocale } from "../../utils/requestLocale"
import { getLocalizedSettingValue } from '../../utils/localizedSettings'
import { requireTrustedRequestOrigin } from '../../utils/domainLocale'
import { validateEmail } from '../../utils/emailValidation'

export default defineEventHandler(async (event) => {
  const siteUrl = requireTrustedRequestOrigin(event)
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        emailPasswordRequired: '邮箱和密码不能为空',
        invalidEmail: '请输入有效的电子邮箱地址',
        disposableEmail: '系统不支持临时/一次性邮箱注册，请使用常用邮箱',
        userExists: '该邮箱已被注册',
      }
    : {
        emailPasswordRequired: 'Email and password are required',
        invalidEmail: 'Please enter a valid email address',
        disposableEmail: 'Disposable email addresses are not supported. Please use a standard email.',
        userExists: 'User with this email already exists',
      };

  const body = await readBody(event)
  const { email: rawEmail, password, nickname, inviteCode } = body
  const promoTracking = mergePromoTracking(
    readPromoTracking(event),
    await capturePromoTracking(event),
  )

  if (!rawEmail || !password) {
    throw createError({
      statusCode: 400,
      message: messages.emailPasswordRequired
    })
  }

  // 严格邮箱合法性校验
  const emailValidation = validateEmail(rawEmail)
  if (!emailValidation.valid) {
    const errorMsg = emailValidation.errorKey === 'email_disposable_rejected'
      ? messages.disposableEmail
      : messages.invalidEmail
    throw createError({
      statusCode: 400,
      message: errorMsg,
    })
  }

  const email = emailValidation.normalizedEmail!

  // Check if user already exists
  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1)
  
  if (existingUser.length > 0) {
    throw createError({
      statusCode: 409,
      message: messages.userExists
    })
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  // Create user
  const newUser = await db.insert(users).values({
    email,
    passwordHash,
    nickname: nickname || email.split('@')[0]
  }).returning()

  const user = newUser[0]

  await ensurePromoMember(user.id)

  const resolvedInviteCode = String(inviteCode || promoTracking.inviteCode || promoTracking.promoCode || '').trim()
  if (resolvedInviteCode) {
    await bindInviteRelation({
      inviteeUserId: user.id,
      inviteCode: resolvedInviteCode,
      source: 'register',
    })
  }

  if (promoTracking.agentCode) {
    await requestPromoAgentJoin({
      userId: user.id,
      agentCode: promoTracking.agentCode,
      source: 'register',
    })
  }

  // Automatically link past guest orders that match this email
  await db.update(orders)
    .set({ userId: user.id })
    .where(eq(orders.contactEmail, user.email))

  // Dispatch event for user registration
  // 支持同步规则强门禁拦截与异步规则后台分发
  try {
    await emitEvent('user.registered', {
      id: user.id,
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      inviteCode: inviteCode,
    })
  } catch (err: any) {
    console.error('[Register] user.registered sync rule failed, rolling back user:', err)
    // 发生同步拦截时，清理刚插入的未生效用户记录，避免脏数据占用邮箱
    try {
      await db.delete(users).where(eq(users.id, user.id))
    } catch (cleanupErr) {
      console.error('[Register] Failed to rollback user after sync rule failure:', cleanupErr)
    }
    throw createError({
      statusCode: err.statusCode || 422,
      statusMessage: err.statusMessage || err.message || '注册前置规则校验失败，操作已终止',
    })
  }

  await issueWebSession(event, user, 'register')

  await trackVisitorEvent(event, {
    visitorId: ensureVisitorId(event),
    userId: user.id,
    eventName: 'auth',
    eventAction: 'register',
  })

  // Send email verification (non-blocking)
  // Generate email verification token (24h expiry)，存进通用的 user_tokens 表
  // （name 标记为 EMAIL_VERIFY_TOKEN_NAME，中间件鉴权会排除这个 purpose，不会当成 API token）
  const verifyToken = crypto.randomUUID()
  const verifyExpiresAt = Math.floor(Date.now() / 1000) + 86400 // 24 hours
  await db.insert(userTokens).values({
    userId: user.id,
    token: verifyToken,
    name: EMAIL_VERIFY_TOKEN_NAME,
    expiresAt: new Date(verifyExpiresAt * 1000),
  })

  const verifyLink = `${siteUrl}/api/auth/verify-email?token=${verifyToken}&lang=${locale}`
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
  }).catch((err) => console.error('[Register] Failed to send verification email:', err))

  if (typeof (event as any)?.waitUntil === 'function') {
    (event as any).waitUntil(emailPromise)
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      emailVerified: false,
      emailVerifiedAt: null,
    }
  }
})
