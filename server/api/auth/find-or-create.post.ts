import { users, usersTokens } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"
import { isMultiDeviceLoginDisabled, generateSessionId } from "../../utils/auth"
import { getRequestLocale } from "../../utils/requestLocale"

function generateApiToken(): string {
  const prefix = 'aps_'
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const randomString = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${prefix}${randomString}`
}

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const body = await readBody(event)
  const { email, password, nickname, createApiToken = false, apiTokenExpiresInDays, apiTokenName } = body

  if (!email) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '邮箱不能为空' : 'Email is required',
    })
  }

  let user: typeof users.$inferSelect
  let created = false

  // Check if user already exists
  const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (existingUsers.length > 0) {
    user = existingUsers[0]
    created = false
  } else {
    // Create new user
    let passwordHash: string | null = null
    if (password) {
      passwordHash = await hashPassword(password)
    }

    const newUser = await db.insert(users).values({
      email,
      passwordHash,
      nickname: nickname || email.split('@')[0],
    }).returning()

    user = newUser[0]
    created = true
  }

  // Update last login
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

  await trackVisitorEvent(event, {
    visitorId: ensureVisitorId(event),
    userId: user.id,
    eventName: 'auth',
    eventAction: created ? 'register' : 'login',
  })

  // 检查是否禁止多设备登录
  const isDisabled = await isMultiDeviceLoginDisabled()
  let sessionId: string | undefined = undefined
  if (isDisabled) {
    // 生成新的会话 ID 并更新到用户表
    sessionId = generateSessionId()
    await db.update(users).set({ currentSessionId: sessionId }).where(eq(users.id, user.id))
  }

  // Set auth session
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
    admin: null,
    sessionId: sessionId // 存储会话 ID 用于验证
  })

  // Create API token if requested
  let apiToken: string | null = null

  if (createApiToken) {
    apiToken = generateApiToken()
    
    let expiresAt: Date | null = null
    if (apiTokenExpiresInDays) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + Number(apiTokenExpiresInDays))
    }

    // 在 users_tokens 表中创建 token
    await db.insert(usersTokens).values({
      userId: user.id,
      token: apiToken,
      name: apiTokenName || 'Auto-generated',
      expiresAt,
    })
  }

  return {
    success: true,
    created,
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
    apiToken, // Only returned if createApiToken is true
  }
})
