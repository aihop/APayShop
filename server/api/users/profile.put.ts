import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from "../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        unauthorized: '未登录',
        noData: '没有可更新的数据',
        profileUpdated: '资料更新成功',
        internalError: '服务器内部错误',
      }
    : {
        unauthorized: 'Unauthorized',
        noData: 'No data to update',
        profileUpdated: 'Profile updated successfully',
        internalError: 'Internal server error',
      }
  const session = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: messages.unauthorized })
  }

  const body = await readBody(event)
  const { nickname, avatarUrl } = body

  if (!nickname && !avatarUrl) {
    return { code: 1, message: messages.noData }
  }

  try {
    const updates: any = {}
    if (nickname !== undefined) updates.nickname = nickname
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl

    await db.update(users)
      .set(updates)
      .where(eq(users.id, session.user.id))

    // Update session data
    if (nickname !== undefined) session.user.nickname = nickname
    if (avatarUrl !== undefined) session.user.avatarUrl = avatarUrl
    await setUserSession(event, session)

    return { code: 0, message: messages.profileUpdated, user: session.user }
  } catch (error: any) {
    console.error('Update profile error:', error)
    return { code: 1, message: error.message || messages.internalError }
  }
})
