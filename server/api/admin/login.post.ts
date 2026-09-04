import { admins } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from '../../utils/requestLocale'
import { recordOperationFromEvent } from '../../utils/auditLog'
import { checkIpRateLimit, resolveClientIp } from '../../utils/rateLimit'
import {
  clearAdminLoginFailure,
  consumeCaptchaTicket,
  getAdminLoginSecurityState,
  recordAdminLoginFailure,
} from '../../utils/adminLoginSecurity'

const ADMIN_LOGIN_AUDIT_DEDUPE_MS = 30 * 60 * 1000

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const ip = resolveClientIp(event)

  // 1. IP 频次限制（单 IP 1 分钟限 10 次）
  const ipLimit = checkIpRateLimit(`admin-login:ip:${ip}`, { max: 10, windowMs: 60_000 })
  if (!ipLimit.ok) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: locale === 'zh' ? '登录请求过于频繁，请稍后再试' : 'Too many login attempts, please try again later',
    })
  }

  const body = await readBody(event)
  const { username, password, captchaTicket } = body || {}

  const auditLoginFailure = (reason: string, admin?: { id: number; username: string }) =>
    recordOperationFromEvent(event, {
      actorId: admin?.id ?? null,
      actorName: admin?.username ?? (typeof username === 'string' ? username.slice(0, 190) : null),
      action: 'loginFailed',
      resource: 'auth',
      details: { reason },
      statusCode: 401,
    })

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '缺少登录凭据' : 'Missing credentials',
    })
  }

  // 2. 账号失败次数与锁定检查
  const secState = getAdminLoginSecurityState(ip, username)
  if (secState.isLocked) {
    const minutes = Math.ceil(secState.lockRemainingMs / 60_000) || 1
    throw createError({
      statusCode: 429,
      message: locale === 'zh'
        ? `尝试过于频繁，账号已被临时锁定，请 ${minutes} 分钟后再试`
        : `Too many attempts. Account locked. Please try again in ${minutes} minute(s)`,
      data: { needCaptcha: true, isLocked: true },
    })
  }

  // 3. 检查是否需要并消费验证码 Ticket（失败 >= 3 次必须验证）
  if (secState.requiresCaptcha) {
    if (!captchaTicket || typeof captchaTicket !== 'string') {
      throw createError({
        statusCode: 403,
        message: locale === 'zh' ? '请先完成安全验证' : 'Please complete the security verification',
        data: { needCaptcha: true },
      })
    }

    const isTicketValid = consumeCaptchaTicket(captchaTicket, ip)
    if (!isTicketValid) {
      throw createError({
        statusCode: 403,
        message: locale === 'zh' ? '安全验证已过期或无效，请重新验证' : 'Security verification expired or invalid, please retry',
        data: { needCaptcha: true },
      })
    }
  }

  // 统一报错文案（消除用户名枚举漏洞）
  const handleCredentialFailure = async (reason: string, adminUser?: { id: number; username: string }) => {
    await auditLoginFailure(reason, adminUser)
    const failState = recordAdminLoginFailure(ip, username)
    if (failState.isLocked) {
      throw createError({
        statusCode: 429,
        message: locale === 'zh'
          ? '密码错误次数过多，账号已被锁定 15 分钟'
          : 'Too many failed attempts. Account locked for 15 minutes',
        data: { needCaptcha: true, isLocked: true },
      })
    }
    throw createError({
      statusCode: 401,
      message: locale === 'zh' ? '用户名或密码错误' : 'Invalid credentials',
      data: { needCaptcha: failState.requiresCaptcha },
    })
  }

  // 4. 查询用户
  const [user] = await db.select().from(admins).where(eq(admins.username, username)).limit(1)

  if (!user) {
    await handleCredentialFailure('unknown_admin')
  }

  // 5. 验证密码
  const isValid = await verifyPassword(user.passwordHash, password)
  if (!isValid) {
    await handleCredentialFailure('bad_password', { id: user.id, username: user.username })
  }

  // 6. 验证成功，清除失败记录
  clearAdminLoginFailure(ip, username)

  // 7. 设置用户会话
  const permsRaw = (user as any).permissions
  const permissions = Array.isArray(permsRaw) ? permsRaw : undefined

  await setUserSession(event, {
    admin: {
      id: user.id,
      username: user.username,
      role: 'admin',
      permissions,
    },
    user: undefined,
    loggedInAt: new Date(),
  })

  await recordOperationFromEvent(event, {
    actorId: user.id,
    actorName: user.username,
    action: 'login',
    resource: 'auth',
    statusCode: 200,
    dedupeWindowMs: ADMIN_LOGIN_AUDIT_DEDUPE_MS,
  })

  return { message: locale === 'zh' ? '登录成功' : 'Login successful' }
})
