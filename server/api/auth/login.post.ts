import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"
import { issueWebSession } from '../../utils/userSessions'
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
