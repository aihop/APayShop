import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from "../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        unauthorized: '未登录',
        passwordsRequired: '旧密码和新密码不能为空',
        userNotFound: '用户不存在',
        incorrectOldPassword: '旧密码错误',
        passwordUpdated: '密码更新成功',
        internalError: '服务器内部错误',
      }
    : {
        unauthorized: 'Unauthorized',
        passwordsRequired: 'Old and new passwords are required',
        userNotFound: 'User not found',
        incorrectOldPassword: 'Incorrect old password',
        passwordUpdated: 'Password updated successfully',
        internalError: 'Internal server error',
      }
  const session = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: messages.unauthorized })
  }

  const body = await readBody(event)
  const { oldPassword, newPassword } = body

  if (!oldPassword || !newPassword) {
    return { code: 1, message: messages.passwordsRequired }
  }

  try {
    const userRecords = await db.select().from(users).where(eq(users.id, session.user.id))
    if (userRecords.length === 0) {
      return { code: 1, message: messages.userNotFound }
    }

    const user = userRecords[0]

    const isValid = await verifyPassword(user.passwordHash, oldPassword)
    if (!isValid) {
      return { code: 1, message: messages.incorrectOldPassword }
    }

    const hashedNewPassword = await hashPassword(newPassword)

    await db.update(users)
      .set({ passwordHash: hashedNewPassword })
      .where(eq(users.id, session.user.id))

    return { code: 0, message: messages.passwordUpdated }
  } catch (error: any) {
    console.error('Update password error:', error)
    return { code: 1, message: error.message || messages.internalError }
  }
})
