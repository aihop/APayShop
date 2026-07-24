import { users } from "../../../db/schema"
import { and, eq, ne } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        userIdRequired: '用户 ID 不能为空',
        emailRequired: '邮箱不能为空',
        emailTaken: '该邮箱已被其他用户占用',
        updated: '用户更新成功',
        failed: '更新用户失败',
      }
    : {
        userIdRequired: 'User ID is required',
        emailRequired: 'Email is required',
        emailTaken: 'Email already taken by another user',
        updated: 'User updated successfully',
        failed: 'Failed to update user',
      }
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: messages.userIdRequired })
    }

    const body = await readBody(event)
    const { username, password } = body
    const email = String(username || '').trim()

    if (!email) {
      throw createError({ statusCode: 400, message: messages.emailRequired })
    }

    const existingUser = await db.select().from(users).where(
      and(
        eq(users.email, email),
        ne(users.id, Number(id)),
      ),
    )

    if (existingUser.length > 0) {
      throw createError({ statusCode: 400, message: messages.emailTaken })
    }

    const updateData: any = {
      email,
      nickname: email.split('@')[0] || email,
    }

    if (password) {
      updateData.passwordHash = await hashPassword(password)
    }

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, Number(id)))

    return { code: 0, message: messages.updated }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || messages.failed,
    })
  }
})
