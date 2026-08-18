import { users, userTokens } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"
import { isMultiDeviceLoginDisabled, generateSessionId } from "../../utils/auth"
import { getRequestLocale } from "../../utils/requestLocale"

function generateApiToken(): string {
  const prefix = 'aps_'
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const randomString = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${prefix}${randomString}`
}

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const body = await readBody(event)
  const { email, password, nickname, createApiToken = false, apiTokenExpiresInDays, apiTokenName } = body

  if (!email) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '邮箱不能为空' : 'Email is required',
    })
  }

  let user: typeof users.$inferSelect
  let created = false

  // Check if user already exists
  const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (existingUsers.length > 0) {
    user = existingUsers[0]
    created = false
  } else {
    // Create new user
    let passwordHash: string | null = null
    if (password) {
      passwordHash = await hashPassword(password)
    }

    try {
      const newUser = await db.insert(users).values({
        email,
        passwordHash,
        nickname: nickname || email.split('@')[0],
      }).returning()

      user = newUser[0]
      created = true
    } catch (err) {
      // 上面的"查不到就插入"不是原子的：本端点专门给服务器对服务器的身份解析用
      // （Qingpu 发 ainode key、webhook 按邮箱补人），同一邮箱并发进来两次时，
      // 两边都会查空、都去插，后到的那次撞 users.email 唯一约束直接 500——
      // 调用方看到的就是"注册后拿不到 AI 密钥"。冲突恰恰说明另一次已经把人建好了，
      // 回查一次即可收敛到同一个用户。
      //
      // 不用 ON CONFLICT / ON DUPLICATE KEY：本仓同时跑 postgresql / mysql /
      // sqlite / d1（server/db/runtime.ts），冲突语法各家不同；捕获后回查是四种
      // 方言都成立的写法。回查仍为空说明不是竞态（字段超长、约束不符等），原样抛出。
      const racedUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)
      if (racedUsers.length === 0) {
        throw err
      }
      console.warn(`[find-or-create] concurrent insert for ${email}, resolved to existing user #${racedUsers[0].id}`)
      user = racedUsers[0]
      created = false
    }
  }

  // Update last login
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

  await trackVisitorEvent(event, {
    visitorId: ensureVisitorId(event),
    userId: user.id,
    eventName: 'auth',
    eventAction: created ? 'register' : 'login',
  })

  // 检查是否禁止多设备登录
  const isDisabled = await isMultiDeviceLoginDisabled()
  let sessionId: string | undefined = undefined
  if (isDisabled) {
    // 生成新的会话 ID 并更新到用户表
    sessionId = generateSessionId()
    await db.update(users).set({ currentSessionId: sessionId }).where(eq(users.id, user.id))
  }

  // Set auth session
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
    admin: null,
    sessionId: sessionId // 存储会话 ID 用于验证
  })

  // Create API token if requested
  let apiToken: string | null = null

  if (createApiToken) {
    apiToken = generateApiToken()
    
    let expiresAt: Date | null = null
    if (apiTokenExpiresInDays) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + Number(apiTokenExpiresInDays))
    }

    // 在 user_tokens 表中创建 token
    await db.insert(userTokens).values({
      userId: user.id,
      token: apiToken,
      name: apiTokenName || 'Auto-generated',
      expiresAt,
    })
  }

  return {
    success: true,
    created,
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
    apiToken, // Only returned if createApiToken is true
  }
})
