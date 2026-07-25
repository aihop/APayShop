import { admins } from "../../db/schema"
import { db } from '../../db/runtime'
import { getRequestLocale } from '../../utils/requestLocale'
import { checkIpRateLimit, resolveClientIp } from '../../utils/rateLimit'

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,32}$/
const MIN_PASSWORD_LEN = 10

function isStrongPassword(pw: string): { ok: boolean; reason?: string } {
  if (typeof pw !== 'string') return { ok: false, reason: 'invalid_type' }
  if (pw.length < MIN_PASSWORD_LEN) return { ok: false, reason: 'too_short' }
  const hasLower = /[a-z]/.test(pw)
  const hasUpper = /[A-Z]/.test(pw)
  const hasDigit = /\d/.test(pw)
  const variety = [hasLower, hasUpper, hasDigit].filter(Boolean).length
  if (variety < 2) return { ok: false, reason: 'too_simple' }
  const commonWeak = new Set(['1234567890', 'password12', 'admin12345', 'qwerty1234', '0987654321'])
  if (commonWeak.has(pw.toLowerCase())) return { ok: false, reason: 'common_password' }
  return { ok: true }
}

function isUniqueViolation(err: unknown): boolean {
  if (!err) return false
  const msg = (err as any).message || ''
  const code = (err as any).code || ''
  const lower = msg.toLowerCase()
  return (
    /unique.*constraint/.test(lower) ||
    /duplicate.*(entry|key|column)/.test(lower) ||
    /sqlite_constraint_unique/.test(lower) ||
    code === '23505' || // PostgreSQL
    code === 'ER_DUP_ENTRY' || // MySQL
    code === 'SQLITE_CONSTRAINT_UNIQUE'
  )
}

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)

  const ip = resolveClientIp(event)
  const rl = checkIpRateLimit(`admin-setup:post:${ip}`, { max: 15, windowMs: 60_000 })
  if (!rl.ok) {
    event.node.res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000))
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: locale === 'zh' ? '请求过于频繁，请稍后再试' : 'Too many requests, please try later',
    })
  }

  const body = await readBody(event)
  const { username, password } = body || {}

  if (!username || !password) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少登录凭据' : 'Missing credentials' })
  }

  const trimmedUsername = typeof username === 'string' ? username.trim() : ''
  if (!USERNAME_REGEX.test(trimmedUsername)) {
    throw createError({
      statusCode: 400,
      message:
        locale === 'zh'
          ? '用户名格式非法，仅限 3-32 位字母、数字、下划线、点或连字符'
          : 'Invalid username: 3-32 chars of letters/digits/_ . - allowed',
    })
  }

  const strength = isStrongPassword(password)
  if (!strength.ok) {
    const messages: Record<string, { zh: string; en: string }> = {
      invalid_type: { zh: '密码格式非法', en: 'Invalid password format' },
      too_short: {
        zh: `密码长度至少 ${MIN_PASSWORD_LEN} 位`,
        en: `Password must be at least ${MIN_PASSWORD_LEN} characters`,
      },
      too_simple: {
        zh: '密码强度不足，需同时包含大小写字母与数字中的至少两类',
        en: 'Password too weak: need at least 2 of lowercase/uppercase/digit',
      },
      common_password: {
        zh: '该密码过于常见，请更换更复杂的密码',
        en: 'This password is too common. Choose a stronger one.',
      },
    }
    const key = (strength.reason as keyof typeof messages) || 'too_simple'
    const { zh, en } = messages[key] ?? messages.too_simple ?? { zh: '密码强度不足', en: 'Password too weak' }
    throw createError({ statusCode: 400, message: locale === 'zh' ? zh : en })
  }

  const passwordHash = await hashPassword(password)

  try {
    const inserted = await db
      .insert(admins)
      .values({
        username: trimmedUsername,
        passwordHash,
      })
      .onConflictDoNothing()
      .returning({ id: (admins as any).id })

    const affected = Array.isArray(inserted) ? inserted.length : (inserted as any)?.rowCount ?? 0
    if (affected === 0) {
      throw createError({ statusCode: 403, message: locale === 'zh' ? '管理员已初始化' : 'Admin already initialized' })
    }
  } catch (err: any) {
    if (err?.statusCode) throw err
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 403, message: locale === 'zh' ? '管理员已初始化' : 'Admin already initialized' })
    }
    throw createError({ statusCode: 500, message: locale === 'zh' ? '初始化失败，请稍后重试' : 'Setup failed, please retry' })
  }

  return { success: true, message: locale === 'zh' ? '管理员初始化完成' : 'Admin initialized' }
})
