import { admins } from "../../../db/schema"
import { eq, ne, and } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { isSuperAdmin, normalizePermissions } from '../../../utils/adminPermissions'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        adminIdRequired: '管理员 ID 不能为空',
        usernameRequired: '用户名不能为空',
        usernameTaken: '该用户名已被其他管理员占用',
        cannotEditMain: '主管理员权限不可修改',
        updated: '管理员更新成功',
        failed: '更新管理员失败',
      }
    : {
        adminIdRequired: 'Admin ID is required',
        usernameRequired: 'Username is required',
        usernameTaken: 'Username already taken by another admin',
        cannotEditMain: 'Permissions of the main admin cannot be modified',
        updated: 'Admin updated successfully',
        failed: 'Failed to update admin',
      }
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: messages.adminIdRequired })
    }
    
    const currentList = await db.select().from(admins).where(eq(admins.id, Number(id))).limit(1)
    if (currentList.length === 0) {
      throw createError({ statusCode: 404, message: messages.failed })
    }
    const current = currentList[0]
    const editingMain = isSuperAdmin(current.username)

    // Defense in depth: the UI hides edit controls for the main admin unless
    // the acting account IS the main admin, but that's client-side only.
    // Any admin holding the "admins" permission could otherwise call this
    // endpoint directly and take over the main account's username/password.
    if (editingMain && !isSuperAdmin(event.context.admin?.username)) {
      throw createError({ statusCode: 403, message: messages.cannotEditMain })
    }

    const body = await readBody(event)
    const { username, password, permissions } = body
    
    if (!username) {
      throw createError({ statusCode: 400, message: messages.usernameRequired })
    }
    
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

    if (!editingMain && permissions !== undefined) {
      // Explicit value only: omitting the field leaves existing permissions
      // untouched. Any provided value (including []) is normalized, with
      // invalid/garbage input safely falling back to "no access" rather
      // than being treated as unset (which would mean full access).
      updateData.permissions = normalizePermissions(permissions, { allowAll: true }) ?? []
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
