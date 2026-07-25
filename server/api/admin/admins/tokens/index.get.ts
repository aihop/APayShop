import { adminTokens, admins } from "../../../../db/schema"
import { desc, eq } from "drizzle-orm"
import { db } from '../../../../db/runtime'
import { getRequestLocale } from '../../../../utils/requestLocale'
import { hasAllPermissions, ADMIN_PERMISSIONS } from '../../../../utils/adminPermissions'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)

  if (event.context.authenticatedFromToken) {
    throw createError({
      statusCode: 403,
      message: locale === 'zh' ? '请使用登录会话管理系统 Token，不能用 Token 本身操作' : 'Manage system tokens from a logged-in session, not via another token',
    })
  }

  try {
    const rows = await db.select({
      id: adminTokens.id,
      name: adminTokens.name,
      permissions: adminTokens.permissions,
      adminId: adminTokens.adminId,
      adminUsername: admins.username,
      lastUsedAt: adminTokens.lastUsedAt,
      expiresAt: adminTokens.expiresAt,
      revoked: adminTokens.revoked,
      createdAt: adminTokens.createdAt,
    })
      .from(adminTokens)
      .leftJoin(admins, eq(adminTokens.adminId, admins.id))
      .orderBy(desc(adminTokens.createdAt))

    const moduleCodeSet = new Set(ADMIN_PERMISSIONS.map(p => p.code))

    const data = rows.map((r: any) => {
      const perms = Array.isArray(r.permissions) ? r.permissions : null
      const grantedModules = new Set(
        (perms || [])
          .map((p: string) => p.split(':')[0])
          .filter((base: string) => moduleCodeSet.has(base))
      )
      const summary = hasAllPermissions(perms)
        ? { all: true, count: ADMIN_PERMISSIONS.length }
        : { all: false, count: grantedModules.size }
      return { ...r, permissionSummary: summary }
    })

    return { data }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || (locale === 'zh' ? '获取系统 Token 列表失败' : 'Failed to fetch system tokens'),
    })
  }
})
