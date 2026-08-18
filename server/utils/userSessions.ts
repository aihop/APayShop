import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { and, eq, lt } from 'drizzle-orm'
import { settings, userSessions, users } from '../db/schema'
import { db } from '../db/runtime'
import { resolveRequestGeo } from './requestGeo'

export const SESSION_REPLACED = 'SESSION_REPLACED'

export type WebSessionAuthMethod = 'password' | 'register' | 'oauth' | 'upstream' | 'handoff'

export interface SessionReplacementDetails {
  code: typeof SESSION_REPLACED
  deviceType: string | null
  browser: string | null
  os: string | null
  ip: string | null
  country: string | null
  region: string | null
  city: string | null
  loggedInAt: string | null
}

export async function readSingleWebSessionPolicyStrict(): Promise<boolean> {
  const rows = await db.select().from(settings)
    .where(eq(settings.key, 'disable_multi_device_login'))
    .limit(1)
  const value = String(rows[0]?.value || '').toLowerCase()
  return value === 'true' || value === '1'
}

export async function readSingleWebSessionPolicy(): Promise<boolean> {
  try {
    return await readSingleWebSessionPolicyStrict()
  } catch (error) {
    console.error('[Auth] Failed to check multi-device login setting:', error)
    return false
  }
}

interface WebSessionUser {
  id: number | string
  email: string
  nickname?: string | null
  avatarUrl?: string | null
}

const hashSessionId = (sessionId: string) => createHash('sha256').update(sessionId).digest('hex')
const sessionPointer = (sessionId: string) => `sha256:${hashSessionId(sessionId)}`
const pointerHash = (pointer: string) => pointer.startsWith('sha256:')
  ? pointer.slice('sha256:'.length)
  : hashSessionId(pointer)
const pointerMatches = (pointer: string, sessionId: string) => pointer.startsWith('sha256:')
  ? pointer === sessionPointer(sessionId)
  : pointer === sessionId

const parseDevice = (userAgent: string) => {
  const ua = userAgent.toLowerCase()
  const deviceType = /ipad|tablet/.test(ua) || (/android/.test(ua) && !/mobi/.test(ua))
    ? 'tablet'
    : /mobi|iphone|android/.test(ua) ? 'mobile' : 'desktop'
  const browser = ua.includes('edg/') ? 'Edge'
    : ua.includes('opr/') || ua.includes('opera') ? 'Opera'
      : ua.includes('chrome/') ? 'Chrome'
        : ua.includes('firefox/') ? 'Firefox'
          : ua.includes('safari/') ? 'Safari'
            : 'Other'
  const os = ua.includes('windows') ? 'Windows'
    : ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios') ? 'iOS'
      : ua.includes('mac os') ? 'macOS'
        : ua.includes('android') ? 'Android'
          : ua.includes('linux') ? 'Linux'
            : 'Other'
  return { deviceType, browser, os }
}

const toReplacementDetails = (row: typeof userSessions.$inferSelect | undefined): SessionReplacementDetails => ({
  code: SESSION_REPLACED,
  deviceType: row?.deviceType || null,
  browser: row?.browser || null,
  os: row?.os || null,
  ip: row?.ip || null,
  country: row?.country || null,
  region: row?.region || null,
  city: row?.city || null,
  loggedInAt: row?.loggedInAt ? new Date(row.loggedInAt).toISOString() : null,
})

export async function issueWebSession(
  event: H3Event,
  user: WebSessionUser,
  authMethod: WebSessionAuthMethod,
): Promise<string> {
  const userId = Number(user.id)
  const sessionId = randomBytes(32).toString('hex')
  const sessionIdHash = hashSessionId(sessionId)
  const userAgent = String(getHeader(event, 'user-agent') || '').slice(0, 1000)
  const device = parseDevice(userAgent)
  const geo = await resolveRequestGeo(event)
  const now = new Date()
  const singleSessionEnabled = await readSingleWebSessionPolicyStrict()

  await db.insert(userSessions).values({
    userId,
    sessionIdHash,
    status: 'active',
    authMethod,
    deviceType: device.deviceType,
    browser: device.browser,
    os: device.os,
    userAgent: userAgent || null,
    ip: geo.ip,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    loggedInAt: now,
    lastSeenAt: now,
    createdAt: now,
  })

  // 该指针是跨 PostgreSQL/MySQL/SQLite/D1 的唯一鉴权事实；并发登录时最后一次
  // 成功更新用户行的会话获胜，user_sessions.status 仅保存审计状态。
  await db.update(users)
    .set({ currentSessionId: sessionPointer(sessionId), lastLoginAt: now })
    .where(eq(users.id, userId))

  if (singleSessionEnabled) {
    await db.update(userSessions)
      .set({
        status: 'replaced',
        endedAt: now,
        replacedBySessionId: sessionIdHash,
      })
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.status, 'active'),
      ))
    await db.update(userSessions)
      .set({ status: 'active', endedAt: null, replacedBySessionId: null })
      .where(eq(userSessions.sessionIdHash, sessionIdHash))
  }

  await replaceUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
    sessionId,
    loggedInAt: now.toISOString(),
  })
  return sessionId
}

export async function getSessionReplacement(
  userId: number,
  sessionId: string,
): Promise<SessionReplacementDetails | null> {
  const userRows = await db.select({ currentSessionId: users.currentSessionId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const currentSessionId = userRows[0]?.currentSessionId || ''
  if (currentSessionId && pointerMatches(currentSessionId, sessionId)) return null

  const currentRows = currentSessionId
    ? await db.select().from(userSessions)
      .where(eq(userSessions.sessionIdHash, pointerHash(currentSessionId)))
      .limit(1)
    : []

  if (sessionId) {
    await db.update(userSessions)
      .set({
        status: 'replaced',
        endedAt: new Date(),
        replacedBySessionId: currentSessionId ? pointerHash(currentSessionId) : null,
      })
      .where(eq(userSessions.sessionIdHash, hashSessionId(sessionId)))
  }
  return toReplacementDetails(currentRows[0])
}

export async function touchWebSession(sessionId: string): Promise<void> {
  const now = new Date()
  await db.update(userSessions)
    .set({ lastSeenAt: now })
    .where(and(
      eq(userSessions.sessionIdHash, hashSessionId(sessionId)),
      eq(userSessions.status, 'active'),
      lt(userSessions.lastSeenAt, new Date(now.getTime() - 60_000)),
    ))
}

export async function endWebSession(sessionId: string, userId?: number, status = 'logged_out'): Promise<void> {
  await db.update(userSessions)
    .set({ status, endedAt: new Date() })
    .where(eq(userSessions.sessionIdHash, hashSessionId(sessionId)))
  if (userId) {
    await db.update(users)
      .set({ currentSessionId: null })
      .where(and(
        eq(users.id, userId),
        eq(users.currentSessionId, sessionPointer(sessionId)),
      ))
  }
}

export function createWebSessionId(): string {
  return randomBytes(32).toString('hex')
}
