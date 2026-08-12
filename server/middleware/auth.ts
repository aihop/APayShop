import { users, usersTokens, admins, adminTokens, settings } from "../db/schema"
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

/**
 * 委派会话（见下方 3.5）在 scope 之外仍可访问的核心路径。逐条都要能说清为什么。
 *
 * 只收两类：
 *  a) 会话壳本身——不放行的话，子账号登录后前端读不到登录态、也退不出登录；
 *  b) 已被证实**不需要登录**的公开读接口——子账号退出登录后照样能拿到同样的数据，
 *     放行不多泄露任何东西，拦下去只会白白打断下载页/博客页。
 *
 * 凡是带账户资产语义的（账单、订阅、发票、佣金、下单、充值、API token、设备凭证）
 * 一律不进这份清单：那正是子账号机制要挡住的东西。
 */
const DELEGATED_SESSION_CORE_ALLOWLIST = [
  '/api/_auth',          // nuxt-auth-utils 的会话读取/清除，useUserSession() 依赖
  '/api/auth/logout',    // 退出登录
  '/api/users/upload',   // 通用上传：被主题 AI 工具页复用，而工具在子账号放行集内
  '/api/products',       // 公开只读（无 requireUserSession）：下载页/产品页
  '/api/posts',          // 公开只读（无 requireUserSession）：博客页
]

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

  // ainode 终态回调使用独立 HMAC 签名，不依赖用户/管理员 Session。
  // 这里只跳过全局 Session 鉴权；handler 仍会严格校验时间戳、事件 ID 与原始 body 签名。
  if (pathname === '/api/qingpu/internal/ainode-task-callback') return

  const isAdminPath = pathname.startsWith("/api/admin")
  const isAuthPath = ADMIN_PUBLIC_PATHS.has(pathname)

  let session: any = { user: undefined, admin: undefined }
  let authenticatedFromToken = false

  try {
    // 2. 先尝试从 cookie 获取 session（原有方式）
    session = await getUserSession(event)
    
    // 3. 如果是从 cookie 会话登录，检查会话是否有效
    //    委派会话（见下方 delegated 说明）跳过这条：它的 user.id 是**店主**，
    //    而 currentSessionId 是店主本人登录时写的。员工登录既不该改写店主那一行
    //    （会让店主和其他员工互相踢下线），又不可能匹配上——不跳过的话，站点一旦
    //    打开「禁止多设备登录」，员工登录成功后的下一个请求就会被判为「已被挤掉」。
    //    委派会话的生命周期由签发方自己复核（每请求查员工状态，停用即时掉线）。
    if (session.user && session.user.id && !session.employee) {
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

  // 3.5 委派会话（delegated session）的作用域闸门。
  //
  // 主题可以签发「以店主身份操作、但不是店主本人」的会话（当前唯一实例：Qingpu 的
  // 员工子账户，见 app/themes/qingpu/server/employees/）。这类会话的 user.id 存的是
  // **店主 id**，因此在核心看来与店主本人的会话完全一样——/api/users/billing、
  // subscription、invoice、promo/commissions、orders/checkout 会原样放行。
  //
  // 主题自己的闸门只能挡主题自己的路由，挡不住核心路由；而核心是唯一看得见每一个
  // 请求的地方。所以这条规则必须落在核心：**带委派标记的会话，只能访问签发方声明的
  // scope 前缀**，其余 /api/** 一律 403。默认拒绝——scope 缺失或非法时同样全拒，
  // 免得「主题忘了写 scope」变成静默放行。
  //
  // 只管 /api/**：页面路由与静态资源不在此拦，页面级可见性由主题自己决定，数据面已经关死。
  const delegated = session?.user && session.employee ? session.employee : null
  if (delegated && pathname.startsWith('/api/')) {
    const scope = typeof delegated.scope === 'string' ? delegated.scope : ''
    const inScope = Boolean(scope) && (pathname === scope || pathname.startsWith(`${scope}/`))
    if (!inScope && !DELEGATED_SESSION_CORE_ALLOWLIST.some(allowed => pathname === allowed || pathname.startsWith(`${allowed}/`))) {
      throw createError({
        statusCode: 403,
        message: '当前子账号没有此操作的权限，请使用店主账号登录',
      })
    }
  }

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
    // 系统级(管理员) token 用独立前缀区分，避免和用户 token 混查两张表。
    if (token && token.startsWith('apay_admin_')) {
      const foundAdminTokens = await db.select()
        .from(adminTokens)
        .where(eq(adminTokens.token, token))
        .limit(1)

      if (foundAdminTokens.length > 0) {
        const tokenRecord = foundAdminTokens[0]
        const now = new Date()
        const isRevoked = tokenRecord.revoked === true || (tokenRecord.revoked as any) === 1
        const isExpired = tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < now

        if (!isRevoked && !isExpired) {
          const foundAdmins = await db.select().from(admins).where(eq(admins.id, tokenRecord.adminId)).limit(1)
          if (foundAdmins.length > 0) {
            const admin = foundAdmins[0]
            session.admin = {
              id: admin.id,
              // Deliberately NOT the real username: isSuperAdmin() does a
              // literal `=== 'admin'` check, which would let a token minted
              // by the superadmin bypass its own chosen scope (permissions
              // below) and get unconditional full access. The token's scope
              // must come only from its own `permissions` column.
              username: `${admin.username}:token:${tokenRecord.id}`,
              role: 'admin',
              permissions: tokenRecord.permissions,
            }
            authenticatedFromToken = true

            // See the matching comment on the user-token path below: route
            // handlers read getUserSession()/requireUserSession(), which
            // only look at h3's own session cache — this bridges into it.
            const runtimeConfig = useRuntimeConfig(event)
            const sessionName = (runtimeConfig.session as any)?.name || 'nuxt-session'
            event.context.sessions = event.context.sessions || Object.create(null)
            ;(event.context.sessions as any)[sessionName] = {
              id: `admin-token:${tokenRecord.id}`,
              createdAt: Date.now(),
              data: { user: undefined, admin: session.admin },
            }

            // Throttled: a scripted caller hitting this every request would
            // otherwise turn "record last use" into a write on every request.
            const lastUsed = tokenRecord.lastUsedAt ? new Date(tokenRecord.lastUsedAt).getTime() : 0
            if (now.getTime() - lastUsed > 60_000) {
              await db.update(adminTokens).set({ lastUsedAt: now }).where(eq(adminTokens.id, tokenRecord.id))
            }
          }
        }
      }
    } else if (token) {
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

            // event.context.user (set below) is NOT what route handlers
            // actually read — every handler in server/api/ calls
            // getUserSession()/requireUserSession() from nuxt-auth-utils,
            // which only looks at h3's own per-request session cache
            // (event.context.sessions[name]), never event.context.user.
            // Without this, a token-authenticated request would pass this
            // middleware but then 401 on every single route handler —
            // the Bearer/X-Api-Key path never actually worked without it.
            // h3's getSession() returns this cache immediately if present,
            // before consulting cookies — and since `id` is non-empty, it
            // also skips the "mint a new session + Set-Cookie" branch, so a
            // token-only request never picks up a session cookie either.
            const runtimeConfig = useRuntimeConfig(event)
            const sessionName = (runtimeConfig.session as any)?.name || 'nuxt-session'
            event.context.sessions = event.context.sessions || Object.create(null)
            ;(event.context.sessions as any)[sessionName] = {
              id: `token:${tokenRecord.id}`,
              createdAt: Date.now(),
              data: { user: session.user, admin: undefined },
            }

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
