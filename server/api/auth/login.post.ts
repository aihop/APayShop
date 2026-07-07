import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"
import { isMultiDeviceLoginDisabled, generateSessionId } from "../../utils/auth"

export default defineEventHandler(async (event) => {

  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }

  const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)
  
  if (existingUsers.length === 0) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  const user = existingUsers[0]

  if (!user.passwordHash) {
    throw createError({
      statusCode: 401,
      message: 'This account uses third-party login'
    })
  }

  const isValid = await verifyPassword(user.passwordHash, password)

  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

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
      avatarUrl: user.avatarUrl
    },
    admin: null,
    sessionId: sessionId // 存储会话 ID 用于验证
  })

  // Update last login
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id))

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
      nickname: user.nickname
    }
  }
})
