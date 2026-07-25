import { usersTokens } from "../../../db/schema"
import { eq, and, or, ne, isNull, desc } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { EMAIL_VERIFY_TOKEN_NAME } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const rows = await db.select({
    id: usersTokens.id,
    name: usersTokens.name,
    lastUsedAt: usersTokens.lastUsedAt,
    expiresAt: usersTokens.expiresAt,
    revoked: usersTokens.revoked,
    createdAt: usersTokens.createdAt,
  })
    .from(usersTokens)
    .where(and(
      eq(usersTokens.userId, userId),
      // ne() against a NULL name is NULL (not true) in SQL, which would
      // silently exclude un-named rows — explicitly allow NULL through.
      or(isNull(usersTokens.name), ne(usersTokens.name, EMAIL_VERIFY_TOKEN_NAME)),
    ))
    .orderBy(desc(usersTokens.createdAt))

  return { data: rows }
})
