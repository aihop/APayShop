import { admins } from "../../../db/schema"
import { eq, ne, and } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        adminIdRequired: '管理员 ID 不能为空',
        usernameRequired: '用户名不能为空',
        usernameTaken: '该用户名已被其他管理员占用',
        updated: '管理员更新成功',
        failed: '更新管理员失败',
      }
    : {
        adminIdRequired: 'Admin ID is required',
        usernameRequired: 'Username is required',
        usernameTaken: 'Username already taken by another admin',
        updated: 'Admin updated successfully',
        failed: 'Failed to update admin',
      }
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: messages.adminIdRequired })
    }
    
    const body = await readBody(event)
    const { username, password } = body
    
    if (!username) {
      throw createError({ statusCode: 400, message: messages.usernameRequired })
    }
    
    // Check if another admin has this username
    const existingUser = await db.select().from(admins).where(
      and(
        eq(admins.username, username),
        ne(admins.id, Number(id))
      )
    )
    
    if (existingUser.length > 0) {
      throw createError({ statusCode: 400, message: messages.usernameTaken })
    }
    
    const updateData: any = { username }
    
    if (password) {
      updateData.passwordHash = await hashPassword(password)
    }
    
    await db.update(admins)
      .set(updateData)
      .where(eq(admins.id, Number(id)))
      
    return { code: 0, message: messages.updated }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || messages.failed
    })
  }
})
