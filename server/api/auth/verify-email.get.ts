import { users, usersTokens } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { EMAIL_VERIFY_TOKEN_NAME } from "../../utils/auth"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = query.token as string

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing verification token',
    })
  }

  // users_tokens.token 有唯一约束（自带索引），按 token 查是 O(1)
  const tokenRows = await db
    .select()
    .from(usersTokens)
    .where(eq(usersTokens.token, token))
    .limit(1)

  const tokenRecord = tokenRows[0]
  if (!tokenRecord || tokenRecord.name !== EMAIL_VERIFY_TOKEN_NAME) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid or expired verification token',
    })
  }

  const userList = await db.select().from(users).where(eq(users.id, tokenRecord.userId)).limit(1)
  const user = userList[0]
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid or expired verification token',
    })
  }

  // Check if already verified
  if (user.emailVerifiedAt) {
    return sendRedirect(event, '/user/dashboard?verified=already')
  }

  // Check revoked / expiry
  const now = new Date()
  const isRevoked = tokenRecord.revoked === true || tokenRecord.revoked === 1
  const isExpired = tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < now

  if (isRevoked || isExpired) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Verification token has expired. Please request a new verification email.',
    })
  }

  // Mark email as verified, revoke the token so it can't be replayed
  await db.update(users)
    .set({ emailVerifiedAt: now })
    .where(eq(users.id, user.id))

  await db.update(usersTokens)
    .set({ revoked: true, lastUsedAt: now })
    .where(eq(usersTokens.id, tokenRecord.id))

  // Redirect to dashboard with success
  return sendRedirect(event, '/user/dashboard?verified=success')
})
