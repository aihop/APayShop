import { userTokens } from "../../../db/schema"
import { eq, and, or, ne, isNull, desc } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { EMAIL_VERIFY_TOKEN_NAME } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const rows = await db.select({
    id: userTokens.id,
    name: userTokens.name,
    lastUsedAt: userTokens.lastUsedAt,
    expiresAt: userTokens.expiresAt,
    revoked: userTokens.revoked,
    createdAt: userTokens.createdAt,
  })
    .from(userTokens)
    .where(and(
      eq(userTokens.userId, userId),
      // ne() against a NULL name is NULL (not true) in SQL, which would
      // silently exclude un-named rows — explicitly allow NULL through.
      or(isNull(userTokens.name), ne(userTokens.name, EMAIL_VERIFY_TOKEN_NAME)),
    ))
    .orderBy(desc(userTokens.createdAt))

  return { data: rows }
})
