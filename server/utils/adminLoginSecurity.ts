import crypto from 'node:crypto'

interface FailureRecord {
  attempts: number
  lastAttemptAt: number
  lockedUntil: number
}

const _failureMap = new Map<string, FailureRecord>()
const _consumedTickets = new Set<string>()
const _activeTickets = new Map<string, { expiresAt: number; ip: string }>()

const WINDOW_MS = 15 * 60 * 1000 // 15 分钟尝试窗口
const LOCK_DURATION_MS = 15 * 60 * 1000 // 锁定 15 分钟
const CAPTCHA_THRESHOLD = 3 // 连续失败达到 3 次要求滑块验证
const LOCK_THRESHOLD = 5 // 连续失败达到 5 次触发账号临时锁定
const TICKET_TTL_MS = 5 * 60 * 1000 // 验证成功后的凭据 5 分钟内有效

function getCacheKey(ip: string, username?: string | null): string {
  const normUser = (username || '').trim().toLowerCase()
  return ip + '|' + normUser
}

function cleanup() {
  const now = Date.now()
  for (const [key, val] of _failureMap) {
    if (val.lockedUntil <= now && now - val.lastAttemptAt > WINDOW_MS) {
      _failureMap.delete(key)
    }
  }
  for (const [ticket, val] of _activeTickets) {
    if (val.expiresAt <= now) {
      _activeTickets.delete(ticket)
      _consumedTickets.delete(ticket)
    }
  }
}

if (typeof setInterval !== 'undefined') {
  const timer = setInterval(cleanup, 60_000)
  timer.unref?.()
}

export function getAdminLoginSecurityState(ip: string, username?: string | null): {
  isLocked: boolean
  lockRemainingMs: number
  requiresCaptcha: boolean
  attempts: number
} {
  const key = getCacheKey(ip, username)
  const now = Date.now()
  const record = _failureMap.get(key)

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

  if (now - record.lastAttemptAt > WINDOW_MS) {
    _failureMap.delete(key)
    return { isLocked: false, lockRemainingMs: 0, requiresCaptcha: false, attempts: 0 }
  }

  return {
    isLocked: false,
    lockRemainingMs: 0,
    requiresCaptcha: record.attempts >= CAPTCHA_THRESHOLD,
    attempts: record.attempts,
  }
}

export function recordAdminLoginFailure(ip: string, username?: string | null): {
  isLocked: boolean
  lockRemainingMs: number
  requiresCaptcha: boolean
  attempts: number
} {
  const key = getCacheKey(ip, username)
  const now = Date.now()
  let record = _failureMap.get(key)

  if (!record || (record.lockedUntil <= now && now - record.lastAttemptAt > WINDOW_MS)) {
    record = { attempts: 1, lastAttemptAt: now, lockedUntil: 0 }
  } else {
    record.attempts += 1
    record.lastAttemptAt = now
  }

  if (record.attempts >= LOCK_THRESHOLD) {
    record.lockedUntil = now + LOCK_DURATION_MS
  }

  _failureMap.set(key, record)

  return {
    isLocked: record.lockedUntil > now,
    lockRemainingMs: Math.max(0, record.lockedUntil - now),
    requiresCaptcha: record.attempts >= CAPTCHA_THRESHOLD,
    attempts: record.attempts,
  }
}

export function clearAdminLoginFailure(ip: string, username?: string | null) {
  const key = getCacheKey(ip, username)
  _failureMap.delete(key)
}

function getHmacSecret(): string {
  return process.env.NUXT_SESSION_PASSWORD || 'apay-internal-admin-captcha-secret-key-2026'
}

function hmacSign(payload: string): string {
  return crypto.createHmac('sha256', getHmacSecret()).update(payload).digest('hex')
}

export interface ChallengePayload {
  x: number
  y: number
  bgIndex: number
  timestamp: number
  nonce: string
}

export function createCaptchaChallengeToken(payload: ChallengePayload): string {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = hmacSign(raw)
  return raw + '.' + signature
}

export function verifyCaptchaChallengeToken(token: string): ChallengePayload | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [raw, signature] = parts
  const expectedSig = hmacSign(raw)
  if (signature !== expectedSig) return null

  try {
    const jsonStr = Buffer.from(raw, 'base64url').toString('utf8')
    const payload = JSON.parse(jsonStr) as ChallengePayload
    const now = Date.now()
    if (now - payload.timestamp > 120_000 || now < payload.timestamp - 5000) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function issueCaptchaTicket(ip: string): string {
  const nonce = crypto.randomBytes(16).toString('hex')
  const timestamp = Date.now()
  const raw = Buffer.from(JSON.stringify({ nonce, timestamp, ip })).toString('base64url')
  const signature = hmacSign(raw)
  const ticket = 'ticket_' + raw + '.' + signature

  _activeTickets.set(ticket, {
    expiresAt: timestamp + TICKET_TTL_MS,
    ip,
  })

  return ticket
}

export function consumeCaptchaTicket(ticket: string, clientIp: string): boolean {
  if (!ticket || typeof ticket !== 'string' || !ticket.startsWith('ticket_')) {
    return false
  }

  if (_consumedTickets.has(ticket)) {
    return false
  }

  const tokenPart = ticket.slice(7)
  const parts = tokenPart.split('.')
  if (parts.length !== 2) return false
  const [raw, signature] = parts
  const expectedSig = hmacSign(raw)
  if (signature !== expectedSig) return false

  try {
    const jsonStr = Buffer.from(raw, 'base64url').toString('utf8')
    const payload = JSON.parse(jsonStr)
    const now = Date.now()
    if (now - payload.timestamp > TICKET_TTL_MS) {
      _activeTickets.delete(ticket)
      return false
    }

    _consumedTickets.add(ticket)
    _activeTickets.delete(ticket)
    return true
  } catch {
    return false
  }
}

// 标准 52x52 紧凑拼图封闭曲线，绝无任何溢出被裁剪问题
export const PUZZLE_PATH = 'M 6 6 H 21 A 5 5 0 0 1 31 6 H 46 V 21 A 5 5 0 0 1 46 31 V 46 H 31 A 5 5 0 0 0 21 46 H 6 Z'

// 现代高质感科技背景图定义（带有网格与发光环，色彩丰富有辨识度）
const SVG_THEMES = [
  {
    defs: '<linearGradient id="bgGrad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="35%" stop-color="#2e1065"/><stop offset="70%" stop-color="#0f172a"/><stop offset="100%" stop-color="#0369a1"/></linearGradient><pattern id="grid1" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/></pattern><radialGradient id="glow1a" cx="20%" cy="30%" r="50%"><stop offset="0%" stop-color="#818cf8" stop-opacity="0.45"/><stop offset="100%" stop-color="#818cf8" stop-opacity="0"/></radialGradient><radialGradient id="glow1b" cx="80%" cy="70%" r="60%"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.45"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/></radialGradient>',
    shapes: '<rect width="330" height="155" fill="url(#bgGrad1)"/><rect width="330" height="155" fill="url(#glow1a)"/><rect width="330" height="155" fill="url(#glow1b)"/><rect width="330" height="155" fill="url(#grid1)"/><circle cx="40" cy="40" r="25" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/><circle cx="290" cy="120" r="35" fill="none" stroke="rgba(56,189,248,0.3)" stroke-width="1.5" stroke-dasharray="4 4"/><path d="M 0 110 Q 80 80 165 120 T 330 90" fill="none" stroke="rgba(129,140,248,0.35)" stroke-width="2"/><path d="M 0 130 Q 100 110 200 140 T 330 115" fill="none" stroke="rgba(56,189,248,0.25)" stroke-width="1.5"/>',
  },
  {
    defs: '<linearGradient id="bgGrad2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#022c22"/><stop offset="40%" stop-color="#064e3b"/><stop offset="75%" stop-color="#0f172a"/><stop offset="100%" stop-color="#0e7490"/></linearGradient><pattern id="grid2" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M 22 0 L 0 0 0 22" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/></pattern><radialGradient id="glow2a" cx="30%" cy="30%" r="55%"><stop offset="0%" stop-color="#34d399" stop-opacity="0.4"/><stop offset="100%" stop-color="#34d399" stop-opacity="0"/></radialGradient><radialGradient id="glow2b" cx="75%" cy="65%" r="60%"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0.4"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>',
    shapes: '<rect width="330" height="155" fill="url(#bgGrad2)"/><rect width="330" height="155" fill="url(#glow2a)"/><rect width="330" height="155" fill="url(#glow2b)"/><rect width="330" height="155" fill="url(#grid2)"/><circle cx="70" cy="115" r="40" fill="none" stroke="rgba(52,211,153,0.25)" stroke-width="1.5"/><circle cx="260" cy="45" r="30" fill="none" stroke="rgba(34,211,238,0.25)" stroke-width="2" stroke-dasharray="6 3"/><path d="M 0 95 C 90 60 180 140 330 80" fill="none" stroke="rgba(52,211,153,0.3)" stroke-width="2"/><path d="M 0 135 C 110 95 210 160 330 110" fill="none" stroke="rgba(34,211,238,0.2)" stroke-width="1.5"/>',
  },
  {
    defs: '<linearGradient id="bgGrad3" x1="10%" y1="0%" x2="90%" y2="100%"><stop offset="0%" stop-color="#4c0519"/><stop offset="35%" stop-color="#3b0764"/><stop offset="70%" stop-color="#18181b"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient><pattern id="grid3" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M 18 0 L 0 0 0 18" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/></pattern><radialGradient id="glow3a" cx="25%" cy="35%" r="50%"><stop offset="0%" stop-color="#fb7185" stop-opacity="0.4"/><stop offset="100%" stop-color="#fb7185" stop-opacity="0"/></radialGradient><radialGradient id="glow3b" cx="80%" cy="65%" r="55%"><stop offset="0%" stop-color="#c084fc" stop-opacity="0.4"/><stop offset="100%" stop-color="#c084fc" stop-opacity="0"/></radialGradient>',
    shapes: '<rect width="330" height="155" fill="url(#bgGrad3)"/><rect width="330" height="155" fill="url(#glow3a)"/><rect width="330" height="155" fill="url(#glow3b)"/><rect width="330" height="155" fill="url(#grid3)"/><circle cx="50" cy="120" r="32" fill="none" stroke="rgba(251,113,133,0.25)" stroke-width="2"/><circle cx="280" cy="40" r="38" fill="none" stroke="rgba(192,132,252,0.3)" stroke-width="1.5" stroke-dasharray="5 4"/><path d="M 0 100 Q 110 150 220 80 T 330 120" fill="none" stroke="rgba(251,113,133,0.3)" stroke-width="2"/><path d="M 0 75 Q 90 40 180 85 T 330 65" fill="none" stroke="rgba(192,132,252,0.25)" stroke-width="1.5"/>',
  }
]

export const CAPTCHA_BACKGROUNDS = SVG_THEMES.map((theme) => {
  const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="330" height="155" viewBox="0 0 330 155"><defs>' + theme.defs + '</defs>' + theme.shapes + '</svg>'
  return 'data:image/svg+xml;base64,' + Buffer.from(rawSvg).toString('base64')
})

// 生成带明显凹槽缺口的背景图（纯 Base64，彻底解决 # 字符被截断问题）
export function generateCaptchaBackgroundWithSlot(targetX: number, targetY: number, bgIndex: number): string {
  const theme = SVG_THEMES[bgIndex % SVG_THEMES.length]
  const slotOverlay = '<g transform="translate(' + targetX + ',' + targetY + ')">' +
    '<path d="' + PUZZLE_PATH + '" fill="rgba(0,0,0,0.8)" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-dasharray="4,3"/>' +
    '</g>'

  const fullSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="330" height="155" viewBox="0 0 330 155">' +
    '<defs>' + theme.defs + '</defs>' +
    theme.shapes +
    slotOverlay +
    '</svg>'

  return 'data:image/svg+xml;base64,' + Buffer.from(fullSvg).toString('base64')
}

// 利用 viewBox 生成独立切片拼图（52x52，纯 Base64，纯白高亮描边）
export function generateCaptchaPiece(targetX: number, targetY: number, bgIndex: number): string {
  const theme = SVG_THEMES[bgIndex % SVG_THEMES.length]
  const pieceSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="' + targetX + ' ' + targetY + ' 52 52">' +
    '<defs>' +
    theme.defs +
    '<clipPath id="pieceClip">' +
    '<path d="' + PUZZLE_PATH + '" transform="translate(' + targetX + ',' + targetY + ')"/>' +
    '</clipPath>' +
    '</defs>' +
    '<g clip-path="url(#pieceClip)">' +
    theme.shapes +
    '</g>' +
    '<path d="' + PUZZLE_PATH + '" transform="translate(' + targetX + ',' + targetY + ')" fill="none" stroke="#ffffff" stroke-width="2"/>' +
    '</svg>'

  return 'data:image/svg+xml;base64,' + Buffer.from(pieceSvg).toString('base64')
}
