import { admins } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        adminIdRequired: '管理员 ID 不能为空',
        adminNotFound: '管理员不存在',
        cannotDeleteMain: '不能删除主管理员账号',
        deleted: '管理员删除成功',
        failed: '删除管理员失败',
      }
    : {
        adminIdRequired: 'Admin ID is required',
        adminNotFound: 'Admin not found',
        cannotDeleteMain: 'Cannot delete the main admin account',
        deleted: 'Admin deleted successfully',
        failed: 'Failed to delete admin',
      }

  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: messages.adminIdRequired })
    }
    
    // Prevent deleting the default admin user
    const user = await db.select().from(admins).where(eq(admins.id, Number(id)))
    if (user.length === 0) {
      throw createError({ statusCode: 404, message: messages.adminNotFound })
    }
    
    if (user[0].username === 'admin') {
      throw createError({ statusCode: 403, message: messages.cannotDeleteMain })
    }
    
    await db.delete(admins).where(eq(admins.id, Number(id)))
    
    return { code: 0, message: messages.deleted }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || messages.failed
    })
  }
})
