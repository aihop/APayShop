import crypto from "crypto"
import { adminTokens } from "../../../../db/schema"
import { eq, count } from "drizzle-orm"
import { db } from '../../../../db/runtime'
import { getRequestLocale } from '../../../../utils/requestLocale'
import { normalizePermissions } from '../../../../utils/adminPermissions'
import { setAuditMeta } from '../../../../utils/auditLog'

const MAX_ACTIVE_TOKENS = 10

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        tokenManageViaToken: '请使用登录会话管理系统 Token，不能用 Token 本身操作',
        nameRequired: 'Token 名称不能为空',
        tooMany: `最多只能创建 ${MAX_ACTIVE_TOKENS} 个有效系统 Token，请先吊销一些`,
        created: '系统 Token 创建成功',
        failed: '创建系统 Token 失败',
      }
    : {
        tokenManageViaToken: 'Manage system tokens from a logged-in session, not via another token',
        nameRequired: 'Token name is required',
        tooMany: `You can have at most ${MAX_ACTIVE_TOKENS} active system tokens — revoke one first`,
        created: 'System token created successfully',
        failed: 'Failed to create system token',
      }

  // Token management must go through a real admin login session — otherwise
  // a single leaked full-access token could mint itself unlimited
  // replacements with no further credential needed.
  if (event.context.authenticatedFromToken) {
    throw createError({ statusCode: 403, message: messages.tokenManageViaToken })
  }

  const adminId = event.context.admin?.id
  if (!adminId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  try {
    const body = await readBody(event)
    const { name, expiresInDays, permissions } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw createError({ statusCode: 400, message: messages.nameRequired })
    }

    const [{ value: activeCount }] = await db.select({ value: count() })
      .from(adminTokens)
      .where(eq(adminTokens.revoked, false as any))
    if (activeCount >= MAX_ACTIVE_TOKENS) {
      throw createError({ statusCode: 400, message: messages.tooMany })
    }

    // Prefixed distinctly from user-level tokens ("apay_") so
    // server/middleware/auth.ts can route to the right table without
    // querying both, and so a leaked-secret scanner can tell them apart.
    const rawToken = `apay_admin_${crypto.randomBytes(32).toString('base64url')}`
    const expiresAt = expiresInDays ? new Date(Date.now() + Number(expiresInDays) * 86400 * 1000) : null
    // Same convention as admins.permissions: defaults to no access unless
    // explicitly granted — never mint a token with implicit full access.
    const normalizedPerms = normalizePermissions(permissions, { allowAll: true }) ?? []

    const inserted = await db.insert(adminTokens).values({
      adminId,
      token: rawToken,
      name: name.trim(),
      permissions: normalizedPerms,
      expiresAt,
    }).returning()

    setAuditMeta(event, {
      summary: `Created system token "${name.trim()}"`,
      details: { name: name.trim(), permissions: normalizedPerms, expiresAt },
    })

    return {
      // Only ever returned here, at creation — cannot be retrieved again.
      token: rawToken,
      data: {
        id: inserted[0].id,
        name: inserted[0].name,
        permissions: normalizedPerms,
        expiresAt: inserted[0].expiresAt,
        createdAt: inserted[0].createdAt,
      },
      message: messages.created,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || messages.failed,
    })
  }
})
