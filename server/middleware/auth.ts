import { users, usersTokens, settings } from "../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../db/runtime'
import { EMAIL_VERIFY_TOKEN_NAME } from '../utils/auth'
import {
  matchPermissionForApiPath,
  adminHasPermission,
  ADMIN_PUBLIC_PATHS,
  isSuperAdmin,
  hasAllPermissions,
  moduleViewCode,
  moduleEditCode,
} from '../utils/adminPermissions'

async function isMultiDeviceLoginDisabled(): Promise<boolean> {
  try {
    const result = await db.select().from(settings).where(eq(settings.key, 'disable_multi_device_login')).limit(1)
    if (result.length > 0 && result[0].value) {
      return result[0].value.toLowerCase() === 'true' || result[0].value === '1'
    }
  } catch (err) {
    console.error('[Auth] Failed to check multi-device login setting:', err)
  }
  return false
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const pathname = url.pathname

  const isAdminPath = pathname.startsWith("/api/admin")
  const isAuthPath = ADMIN_PUBLIC_PATHS.has(pathname)

  let session: any = { user: undefined, admin: undefined }
  let authenticatedFromToken = false

  try {
    // 2. 先尝试从 cookie 获取 session（原有方式）
    session = await getUserSession(event)
    
    // 3. 如果是从 cookie 会话登录，检查会话是否有效
    if (session.user && session.user.id) {
      const checkDisabled = await isMultiDeviceLoginDisabled()
      if (checkDisabled) {
        // 检查当前 cookie 会话的 sessionId 是否与用户表中的 currentSessionId 匹配
        const foundUsers = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
        if (foundUsers.length > 0) {
          const user = foundUsers[0]
          // 如果 session 中没有 sessionId 或者不匹配，说明会话已被挤掉
          if (!session.sessionId || session.sessionId !== user.currentSessionId) {
            // 清除这个过期的会话
            await clearUserSession(event)
            session.user = null
          }
        }
      }
    }
  } catch {}

  // 4. 如果没有 session，尝试从 header 或 query 获取 token（API token 不受多设备限制）
  if (!session.user && !session.admin) {
    const incomingHeaders = event.node.req.headers
    let token: string | null = null
    
    // 只从 header 取 token:
    // - Authorization: Bearer <token>
    // - X-Api-Key: <token>
    // 已移除 ?api_key= 查询参数分支——URL 会被 access log / 代理日志原样记录,
    // 是公认的 token 泄露面(全仓无调用方依赖此方式)
    const authHeader = incomingHeaders['authorization'] as string
    const xApiKey = incomingHeaders['x-api-key'] as string

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    } else if (xApiKey) {
      token = xApiKey
    }

    // 5. 如果有 token，验证 token（API token 不限制多设备）
    if (token) {
      // 从 users_tokens 表查找 token
      const foundTokens = await db.select()
        .from(usersTokens)
        .where(eq(usersTokens.token, token))
        .limit(1)
      
      if (foundTokens.length > 0) {
        const tokenRecord = foundTokens[0]
        
        // 检查：token 是否撤销、过期，以及是否是「专用」token（如邮箱验证 token）——
        // 后者只在各自的业务接口里消费，绝不能顺带当成站内 API token 通过全局鉴权
        const now = new Date()
        const isRevoked = tokenRecord.revoked === true || tokenRecord.revoked === 1
        const isExpired = tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < now
        const isSpecialPurpose = tokenRecord.name === EMAIL_VERIFY_TOKEN_NAME

        if (!isRevoked && !isExpired && !isSpecialPurpose) {
          // 查找对应的 user
          const foundUsers = await db.select().from(users).where(eq(users.id, tokenRecord.userId)).limit(1)
          if (foundUsers.length > 0) {
            const user = foundUsers[0]
            session.user = {
              id: user.id,
              email: user.email,
              nickname: user.nickname,
              avatarUrl: user.avatarUrl
            }
            authenticatedFromToken = true
            
            // 更新 lastUsedAt
            await db.update(usersTokens).set({ lastUsedAt: now }).where(eq(usersTokens.id, tokenRecord.id))
          }
        }
      }
    }
  }

  // 先挂到 context 再做权限校验：越权被拒(403)时也要能追溯到是谁在尝试，
  // 审计插件在 afterResponse 里正是从 context.admin 取操作人的。
  event.context.user = session.user
  event.context.admin = session.admin
  event.context.authenticatedFromToken = authenticatedFromToken

  // 6. 后台路径权限校验
  if (isAdminPath && !isAuthPath) {
    if (!session.admin) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized: Admin access required"
      })
    }
    const required = matchPermissionForApiPath(pathname)
    if (required) {
      // GET/HEAD only need the "view" tier; any mutating method needs "edit".
      // adminHasPermission() also honors a legacy bare grant (e.g. "orders",
      // predating this split) as full access to both tiers.
      const method = (event.method || 'GET').toUpperCase()
      const isMutating = method !== 'GET' && method !== 'HEAD'
      const requiredTiered = isMutating ? moduleEditCode(required) : moduleViewCode(required)
      if (!adminHasPermission(session.admin, requiredTiered)) {
        throw createError({
          statusCode: 403,
          statusMessage: `Forbidden: requires permission "${requiredTiered}"`
        })
      }
    } else if (
      // Path has no known permission mapping (e.g. a new or theme-added
      // admin API). Deny by default instead of letting any admin through.
      !isSuperAdmin(session.admin?.username) &&
      !hasAllPermissions(session.admin?.permissions)
    ) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: no permission mapping for this admin route'
      })
    }
  }
})
