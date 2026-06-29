import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = query.token as string

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing verification token',
    })
  }

  // Find user with matching token
  const userList = await db
    .select()
    .from(users)
    .where(eq(users.emailVerifyToken, token))
    .limit(1)

  if (!userList.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid or expired verification token',
    })
  }

  const user = userList[0]

  // Check if already verified
  if (user.emailVerifiedAt) {
    return sendRedirect(event, '/user/dashboard?verified=already')
  }

  // Check expiry
  const now = Date.now()
  const expiresAt = user.emailVerifyExpiresAt instanceof Date
    ? user.emailVerifyExpiresAt.getTime()
    : new Date(user.emailVerifyExpiresAt as any).getTime()

  if (now > expiresAt) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Verification token has expired. Please request a new verification email.',
    })
  }

  // Mark email as verified
  await db.update(users)
    .set({
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
      emailVerifyExpiresAt: null,
    })
    .where(eq(users.id, user.id))

  // Redirect to dashboard with success
  return sendRedirect(event, '/user/dashboard?verified=success')
})
