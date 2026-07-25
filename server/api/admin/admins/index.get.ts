import { admins } from "../../../db/schema"
import { desc,count } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { hasAllPermissions, ADMIN_PERMISSIONS } from '../../../utils/adminPermissions'
 
export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 12
  const offset = (page - 1) * pageSize

  const totalResult = await db.select({ value: count() }).from(admins)
  const total = totalResult[0]?.value || 0
  
  try {
    const rawResult = await db.select({
      id:  admins.id,
      username: admins.username,
      permissions: admins.permissions,
      createdAt: admins.createdAt
    })
    .from(admins)
    .orderBy(desc(admins.createdAt))
    .limit(pageSize)
    .offset(offset)

    const data = (rawResult as any[]).map((r: any) => {
      const perms = Array.isArray(r.permissions) ? r.permissions : null
      const summary = hasAllPermissions(perms)
        ? { all: true, count: ADMIN_PERMISSIONS.length }
        : { all: false, count: (perms?.length) || 0 }
      return {
        id: r.id,
        username: r.username,
        permissions: perms,
        permissionSummary: summary,
        createdAt: r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : r.createdAt
            ? new Date(r.createdAt as any).toISOString()
            : null,
      }
    })
    
    return {
      data,
      total,
      page,
      pageSize
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || (locale === 'zh' ? '获取管理员列表失败' : 'Failed to fetch admins')
    })
  }
})
