import { adminTokens } from "../../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../../db/runtime'
import { getRequestLocale } from '../../../../utils/requestLocale'
import { setAuditMeta } from '../../../../utils/auditLog'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        tokenManageViaToken: '请使用登录会话管理系统 Token，不能用 Token 本身操作',
        idRequired: 'Token ID 不能为空',
        notFound: 'Token 不存在',
        revoked: '系统 Token 已吊销',
        failed: '吊销系统 Token 失败',
      }
    : {
        tokenManageViaToken: 'Manage system tokens from a logged-in session, not via another token',
        idRequired: 'Token ID is required',
        notFound: 'Token not found',
        revoked: 'System token revoked',
        failed: 'Failed to revoke system token',
      }

  if (event.context.authenticatedFromToken) {
    throw createError({ statusCode: 403, message: messages.tokenManageViaToken })
  }

  try {
    const id = Number(getRouterParam(event, 'id'))
    if (!id) {
      throw createError({ statusCode: 400, message: messages.idRequired })
    }

    const existing = await db.select({ id: adminTokens.id, name: adminTokens.name })
      .from(adminTokens)
      .where(eq(adminTokens.id, id))
      .limit(1)

    if (existing.length === 0) {
      throw createError({ statusCode: 404, message: messages.notFound })
    }

    // Soft revoke — keeps the row (and its lastUsedAt/createdAt history)
    // instead of deleting, matching users_tokens' own revoked-flag intent.
    await db.update(adminTokens)
      .set({ revoked: true })
      .where(eq(adminTokens.id, id))

    setAuditMeta(event, {
      summary: `Revoked system token "${existing[0].name || existing[0].id}"`,
      details: { id: existing[0].id, name: existing[0].name },
    })

    return { code: 0, message: messages.revoked }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || messages.failed,
    })
  }
})
