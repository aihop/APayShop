import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"
import { issueWebSession } from '../../utils/userSessions'
import { getRequestLocale } from "../../utils/requestLocale"
import { checkIpRateLimit, resolveClientIp } from '../../utils/rateLimit'
import {
  clearUserLoginFailure,
  consumeCaptchaTicket,
  getUserLoginSecurityState,
  recordUserLoginFailure,
} from '../../utils/userLoginSecurity'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const ip = resolveClientIp(event)

  const messages = locale === 'zh'
    ? {
        emailPasswordRequired: '邮箱和密码不能为空',
        invalidCredentials: '邮箱或密码错误',
        thirdPartyLogin: '该账号使用第三方登录',
        rateLimited: '登录尝试过于频繁，请稍后再试',
        needCaptcha: '请先完成安全验证',
        captchaExpired: '安全验证已过期或无效，请重新验证',
      }
    : {
        emailPasswordRequired: 'Email and password are required',
        invalidCredentials: 'Invalid email or password',
        thirdPartyLogin: 'This account uses third-party login',
        rateLimited: 'Too many login attempts, please try again later',
        needCaptcha: 'Please complete the security verification',
        captchaExpired: 'Security verification expired or invalid, please retry',
      };

  // 1. IP 频次限制（单 IP 1 分钟限 30 次）
  const ipLimit = checkIpRateLimit(`user-login:ip:${ip}`, { max: 30, windowMs: 60_000 })
  if (!ipLimit.ok) {
    throw createError({
      statusCode: 429,
      message: messages.rateLimited,
    })
  }

  const body = await readBody(event)
  const { email, password, captchaTicket } = body || {}

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: messages.emailPasswordRequired,
    })
  }

  // 2. IP + Email 联合维度安全检查（失败 3 次出滑块，5 次锁定当前 IP 对该账号的尝试）
  const secState = getUserLoginSecurityState(ip, email)
  if (secState.isLocked) {
    const minutes = Math.ceil(secState.lockRemainingMs / 60_000) || 1
    throw createError({
      statusCode: 429,
      message: locale === 'zh'
        ? `登录失败次数过多，已被临时锁定，请 ${minutes} 分钟后再试`
        : `Too many failed attempts. Temporarily locked. Please try again in ${minutes} minute(s)`,
      data: { needCaptcha: true, isLocked: true },
    })
  }

  if (secState.requiresCaptcha) {
    if (!captchaTicket || typeof captchaTicket !== 'string') {
      throw createError({
        statusCode: 403,
        message: messages.needCaptcha,
        data: { needCaptcha: true },
      })
    }

    const isTicketValid = consumeCaptchaTicket(captchaTicket, ip)
    if (!isTicketValid) {
      throw createError({
        statusCode: 403,
        message: messages.captchaExpired,
        data: { needCaptcha: true },
      })
    }
  }

  const handleAuthFailure = (message: string) => {
    const failState = recordUserLoginFailure(ip, email)
    if (failState.isLocked) {
      throw createError({
        statusCode: 429,
        message: locale === 'zh'
          ? '密码错误次数过多，已被锁定 15 分钟'
          : 'Too many failed attempts. Locked for 15 minutes',
        data: { needCaptcha: true, isLocked: true },
      })
    }
    throw createError({
      statusCode: 401,
      message,
      data: { needCaptcha: failState.requiresCaptcha },
    })
  }

  // 3. 查询用户
  const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)
  
  if (existingUsers.length === 0) {
    handleAuthFailure(messages.invalidCredentials)
  }

  const user = existingUsers[0]

  if (!user.passwordHash) {
    throw createError({
      statusCode: 401,
      message: messages.thirdPartyLogin,
    })
  }

  // 4. 验证密码
  const isValid = await verifyPassword(user.passwordHash, password)

  if (!isValid) {
    handleAuthFailure(messages.invalidCredentials)
  }

  // 5. 登录成功，清除失败记录
  clearUserLoginFailure(ip, email)

  await issueWebSession(event, user, 'password')

  await trackVisitorEvent(event, {
    visitorId: ensureVisitorId(event),
    userId: user.id,
    eventName: 'auth',
    eventAction: 'login',
  })

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      emailVerified: Boolean(user.emailVerifiedAt),
      emailVerifiedAt: user.emailVerifiedAt || null,
    }
  }
})
