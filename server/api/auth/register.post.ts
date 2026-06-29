import { users, orders } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { dispatchEvent } from "../../utils/eventBus"
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"
import { sendEmail } from "../../utils/email"

export default defineEventHandler(async (event) => {

  const body = await readBody(event)
  const { email, password, nickname, inviteCode } = body

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
      nickname: user.nickname,
      inviteCode: inviteCode
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

  // Send email verification (non-blocking)
  const acceptLanguage = getHeaders(event)['accept-language'] || 'en'
  const locale = acceptLanguage.startsWith('zh') ? 'zh' : 'en'

  // Generate email verification token (24h expiry)
  const verifyToken = crypto.randomUUID()
  const verifyExpiresAt = Math.floor(Date.now() / 1000) + 86400 // 24 hours
  await db.update(users)
    .set({
      emailVerifyToken: verifyToken,
      emailVerifyExpiresAt: new Date(verifyExpiresAt * 1000),
    })
    .where(eq(users.id, user.id))

  const siteUrl = getRequestURL(event).origin
  const verifyLink = `${siteUrl}/api/auth/verify-email?token=${verifyToken}`
  sendEmail({
    to: user.email,
    templateCode: 'verify_email',
    locale,
    variables: {
      nickname: user.nickname || user.email.split('@')[0],
      site_name: 'APayShop',
      site_url: siteUrl,
      verify_link: verifyLink,
    },
  }).catch((err) => console.error('[Register] Failed to send verification email:', err))

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname
    }
  }
})
