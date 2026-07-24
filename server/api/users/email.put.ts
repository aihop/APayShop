import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from "../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        unauthorized: '未登录',
        emailPasswordRequired: '邮箱和密码不能为空',
        userNotFound: '用户不存在',
        incorrectPassword: '密码错误',
        emailInUse: '该邮箱已被占用',
        emailUpdated: '邮箱更新成功',
        internalError: '服务器内部错误',
      }
    : {
        unauthorized: 'Unauthorized',
        emailPasswordRequired: 'Email and password are required',
        userNotFound: 'User not found',
        incorrectPassword: 'Incorrect password',
        emailInUse: 'Email is already in use',
        emailUpdated: 'Email updated successfully',
        internalError: 'Internal server error',
      }
  const session = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: messages.unauthorized })
  }

  const body = await readBody(event)
  const { newEmail, password } = body

  if (!newEmail || !password) {
    return { code: 1, message: messages.emailPasswordRequired }
  }

  try {
    const userRecords = await db.select().from(users).where(eq(users.id, session.user.id))
    if (userRecords.length === 0) {
      return { code: 1, message: messages.userNotFound }
    }

    const user = userRecords[0]

    const isValid = await verifyPassword(user.passwordHash, password)
    if (!isValid) {
      return { code: 1, message: messages.incorrectPassword }
    }

    // Check if new email is already taken
    const existingUser = await db.select().from(users).where(eq(users.email, newEmail))
    if (existingUser.length > 0) {
      return { code: 1, message: messages.emailInUse }
    }

    await db.update(users)
      .set({ email: newEmail })
      .where(eq(users.id, session.user.id))

    // Update session data
    session.user.email = newEmail
    await setUserSession(event, session)

    return { code: 0, message: messages.emailUpdated, user: session.user }
  } catch (error: any) {
    console.error('Update email error:', error)
    return { code: 1, message: error.message || messages.internalError }
  }
})
