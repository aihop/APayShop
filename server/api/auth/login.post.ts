import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"
import { isMultiDeviceLoginDisabled, generateSessionId } from "../../utils/auth"
import { getRequestLocale } from "../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        emailPasswordRequired: '邮箱和密码不能为空',
        invalidCredentials: '邮箱或密码错误',
        thirdPartyLogin: '该账号使用第三方登录',
      }
    : {
        emailPasswordRequired: 'Email and password are required',
        invalidCredentials: 'Invalid email or password',
        thirdPartyLogin: 'This account uses third-party login',
      };

  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: messages.emailPasswordRequired
    })
  }

  const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)
  
  if (existingUsers.length === 0) {
    throw createError({
      statusCode: 401,
      message: messages.invalidCredentials
    })
  }

  const user = existingUsers[0]

  if (!user.passwordHash) {
    throw createError({
      statusCode: 401,
      message: messages.thirdPartyLogin
    })
  }

  const isValid = await verifyPassword(user.passwordHash, password)

  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: messages.invalidCredentials
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

  // 用 replaceUserSession 而不是 setUserSession:后者是 defu 合并,`admin: null`
  // 并不会覆盖浏览器里既有的管理员声明(defu 不拿 null 盖旧值),同理任何由主题
  // 写入的委派声明也会残留下来——表现为登录成功却继承了上一个身份的权限。
  // 一次登录就该是一个全新会话,整份替换。
  await replaceUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl
    },
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
