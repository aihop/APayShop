import { admins } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body

  if (!username || !password) {
    throw createError({ statusCode: 400, message: "Missing credentials" })
  }

  // 1. 查询用户
  const [user] = await db.select().from(admins).where(eq(admins.username, username)).limit(1)

  if (!user) {
    throw createError({ statusCode: 401, message: "Admin not found" })
  }

  // 2. 验证密码 (使用 nuxt-auth-utils 内置的高性能验证)
  const isValid = await verifyPassword(user.passwordHash, password)
  if (!isValid) {
    throw createError({ statusCode: 401, message: "Invalid credentials" })
  }

  // 3. 设置用户会话 (取代 jwt.sign)
  // 这会自动创建一个加密的 HttpOnly Cookie，存储在浏览器中
  await setUserSession(event, {
    admin: {
      id: user.id,
      username: user.username,
      role: 'admin' // 你可以按需添加字段
    },
    user: null,
    loggedInAt: new Date()
  })

  return { message: "Login successful" }
})