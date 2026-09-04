import { consumeCaptchaTicket } from './adminLoginSecurity.ts'

interface UserFailureRecord {
  attempts: number
  lastAttemptAt: number
  lockedUntil: number
}

// 采用 IP + Email 联合维度记录失败，确保单一恶意 IP 的爆破不会把其他正常 IP 的真实用户锁死
const _userFailureMap = new Map<string, UserFailureRecord>()

const USER_WINDOW_MS = 15 * 60 * 1000 // 15 分钟窗口
const USER_LOCK_DURATION_MS = 15 * 60 * 1000 // 锁定 15 分钟
const USER_CAPTCHA_THRESHOLD = 3 // 连续失败达到 3 次要求滑块验证
const USER_LOCK_THRESHOLD = 5 // 连续失败达到 5 次临时锁定该 IP 对该邮箱的尝试

function getCacheKey(ip: string, email?: string | null): string {
  const normEmail = (email || '').trim().toLowerCase()
  return ip + '|' + normEmail
}

function cleanup() {
  const now = Date.now()
  for (const [key, val] of _userFailureMap) {
    if (val.lockedUntil <= now && now - val.lastAttemptAt > USER_WINDOW_MS) {
      _userFailureMap.delete(key)
    }
  }
}

if (typeof setInterval !== 'undefined') {
  const timer = setInterval(cleanup, 60_000)
  timer.unref?.()
}

export function getUserLoginSecurityState(ip: string, email?: string | null): {
  isLocked: boolean
  lockRemainingMs: number
  requiresCaptcha: boolean
  attempts: number
} {
  const key = getCacheKey(ip, email)
  const now = Date.now()
  const record = _userFailureMap.get(key)

  if (!record) {
    return { isLocked: false, lockRemainingMs: 0, requiresCaptcha: false, attempts: 0 }
  }

  if (record.lockedUntil > now) {
    return {
      isLocked: true,
      lockRemainingMs: record.lockedUntil - now,
      requiresCaptcha: true,
      attempts: record.attempts,
    }
  }

  if (now - record.lastAttemptAt > USER_WINDOW_MS) {
    _userFailureMap.delete(key)
    return { isLocked: false, lockRemainingMs: 0, requiresCaptcha: false, attempts: 0 }
  }

  return {
    isLocked: false,
    lockRemainingMs: 0,
    requiresCaptcha: record.attempts >= USER_CAPTCHA_THRESHOLD,
    attempts: record.attempts,
  }
}

export function recordUserLoginFailure(ip: string, email?: string | null): {
  isLocked: boolean
  lockRemainingMs: number
  requiresCaptcha: boolean
  attempts: number
} {
  const key = getCacheKey(ip, email)
  const now = Date.now()
  let record = _userFailureMap.get(key)

  if (!record || (record.lockedUntil <= now && now - record.lastAttemptAt > USER_WINDOW_MS)) {
    record = { attempts: 1, lastAttemptAt: now, lockedUntil: 0 }
  } else {
    record.attempts += 1
    record.lastAttemptAt = now
  }

  if (record.attempts >= USER_LOCK_THRESHOLD) {
    record.lockedUntil = now + USER_LOCK_DURATION_MS
  }

  _userFailureMap.set(key, record)

  return {
    isLocked: record.lockedUntil > now,
    lockRemainingMs: Math.max(0, record.lockedUntil - now),
    requiresCaptcha: record.attempts >= USER_CAPTCHA_THRESHOLD,
    attempts: record.attempts,
  }
}

export function clearUserLoginFailure(ip: string, email?: string | null) {
  const key = getCacheKey(ip, email)
  _userFailureMap.delete(key)
}

// 导出通用的验证码 Ticket 消费逻辑（防重放、一次性使用）
export { consumeCaptchaTicket }
