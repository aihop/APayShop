import { users, orders } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'
import { dispatchEvent } from "../../utils/eventBus"
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"

export default defineEventHandler(async (event) => {

  const body = await readBody(event)
  const { email, password, nickname } = body

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }

  // Check if user already exists
  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1)
  
  if (existingUser.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'User with this email already exists'
    })
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  // Create user
  const newUser = await db.insert(users).values({
    email,
    passwordHash,
    nickname: nickname || email.split('@')[0]
  }).returning()

  const user = newUser[0]

  // Automatically link past guest orders that match this email
  await db.update(orders)
    .set({ userId: user.id })
    .where(eq(orders.contactEmail, user.email))

  // Dispatch event for user registration
  try {
    dispatchEvent('user.registered', {
      id: user.id,
      email: user.email,
      nickname: user.nickname
    })
  } catch (err) {
    console.error('Failed to dispatch user.registered event', err)
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

  await trackVisitorEvent(event, {
    visitorId: ensureVisitorId(event),
    userId: user.id,
    eventName: 'auth',
    eventAction: 'register',
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
