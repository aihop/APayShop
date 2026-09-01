import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from "../../utils/requestLocale"
import { emitEvent } from "../../utils/eventActions"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const body = await readBody(event)
  const { email, password, nickname, createApiToken = false } = body

  if (!email) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '邮箱不能为空' : 'Email is required',
    })
  }
  if (createApiToken) {
    throw createError({
      statusCode: 403,
      message: locale === 'zh' ? '此身份解析接口不能创建 API Token' : 'This identity endpoint cannot create API tokens',
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

  if (created && user) {
    try {
      await emitEvent('user.registered', {
        id: user.id,
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        source: 'find_or_create',
      })
    } catch (eventErr) {
      console.error(`[find-or-create] user.registered event failed for #${user.id}:`, eventErr)
    }
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
    apiToken: null,
  }
})
