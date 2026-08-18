import { userTokens } from "../../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session = await requireUserSession(event)
  const userId = session.user.id

  if (event.context.authenticatedFromToken) {
    throw createError({
      statusCode: 403,
      message: locale === 'zh' ? '请使用登录会话管理 API Token，不能用 Token 本身操作' : 'Manage API tokens from a logged-in session, not via another token',
    })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '请求无效' : 'Invalid request' })
  }

  const existing = await db.select({ id: userTokens.id })
    .from(userTokens)
    .where(and(eq(userTokens.id, id), eq(userTokens.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: locale === 'zh' ? 'Token 不存在' : 'Token not found' })
  }

  // Soft revoke — keeps the row (and its lastUsedAt/createdAt history)
  // instead of deleting, matching the schema's own `revoked` column intent.
  await db.update(userTokens)
    .set({ revoked: true })
    .where(eq(userTokens.id, id))

  return { success: true }
})
