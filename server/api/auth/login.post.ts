import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"

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

  // Set auth session
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl
    },
    admin: null,
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
