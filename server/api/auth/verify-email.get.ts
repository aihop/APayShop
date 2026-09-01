import { users, userTokens } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { EMAIL_VERIFY_TOKEN_NAME } from "../../utils/auth"
import { normalizeSupportedLocale, sendLocalizedRedirect } from "../../utils/localizedRouting"
import { getRequestLocale } from "../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = query.token as string
  const rawLang = query.lang || query.locale || getRequestLocale(event)
  const lang = normalizeSupportedLocale(rawLang)

  if (!token) {
    return sendLocalizedRedirect(event, '/auth/login?verified=missing', lang)
  }

  // user_tokens.token 有唯一约束（自带索引），按 token 查是 O(1)
  const tokenRows = await db
    .select()
    .from(userTokens)
    .where(eq(userTokens.token, token))
    .limit(1)

  const tokenRecord = tokenRows[0]
  if (!tokenRecord || tokenRecord.name !== EMAIL_VERIFY_TOKEN_NAME) {
    return sendLocalizedRedirect(event, '/auth/login?verified=invalid', lang)
  }

  const userList = await db.select().from(users).where(eq(users.id, tokenRecord.userId)).limit(1)
  const user = userList[0]
  if (!user) {
    return sendLocalizedRedirect(event, '/auth/login?verified=invalid', lang)
  }

  // Check if already verified
  if (user.emailVerifiedAt) {
    return sendLocalizedRedirect(event, '/auth/login?verified=already', lang)
  }

  // Check revoked / expiry
  const now = new Date()
  const isRevoked = tokenRecord.revoked === true || tokenRecord.revoked === 1
  const isExpired = tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < now

  if (isRevoked || isExpired) {
    return sendLocalizedRedirect(event, '/auth/login?verified=expired', lang)
  }

  // Mark email as verified, revoke the token so it can't be replayed
  await db.update(users)
    .set({ emailVerifiedAt: now })
    .where(eq(users.id, user.id))

  await db.update(userTokens)
    .set({ revoked: true, lastUsedAt: now })
    .where(eq(userTokens.id, tokenRecord.id))

  // 若当前浏览器已登录该用户，即时更新 Session Cookie 中的验证状态
  const session = await getUserSession(event).catch(() => null)
  if (session?.user && Number((session.user as any).id) === user.id) {
    await setUserSession(event, {
      ...session,
      user: {
        ...session.user,
        emailVerified: true,
        emailVerifiedAt: now,
      },
    })
  }

  // Redirect to login with success
  return sendLocalizedRedirect(event, '/auth/login?verified=success', lang)
})
