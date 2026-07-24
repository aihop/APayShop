import { users } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        userIdRequired: '用户 ID 不能为空',
        userNotFound: '用户不存在',
        deleted: '用户删除成功',
        failed: '删除用户失败',
      }
    : {
        userIdRequired: 'User ID is required',
        userNotFound: 'User not found',
        deleted: 'User deleted successfully',
        failed: 'Failed to delete user',
      }
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: messages.userIdRequired })
    }

    const user = await db.select().from(users).where(eq(users.id, Number(id)))
    if (user.length === 0) {
      throw createError({ statusCode: 404, message: messages.userNotFound })
    }

    await db.delete(users).where(eq(users.id, Number(id)))

    return { code: 0, message: messages.deleted }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || messages.failed,
    })
  }
})
