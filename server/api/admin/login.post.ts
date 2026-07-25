import { admins } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from '../../utils/requestLocale'
import { recordOperationFromEvent } from '../../utils/auditLog'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const body = await readBody(event)
  const { username, password } = body

  // Audited by hand rather than by the plugin: on the failure paths there is
  // no session to attribute the attempt to, and a failed admin login is
  // exactly the record you want when something goes wrong.
  const auditLoginFailure = (reason: string, admin?: { id: number; username: string }) =>
    recordOperationFromEvent(event, {
      actorId: admin?.id ?? null,
      actorName: admin?.username ?? (typeof username === 'string' ? username.slice(0, 190) : null),
      action: 'login.failed',
      resource: 'auth',
      details: { reason },
      statusCode: 401,
    })

  if (!username || !password) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少登录凭据' : 'Missing credentials' })
  }

  // 1. 查询用户
  const [user] = await db.select().from(admins).where(eq(admins.username, username)).limit(1)

  if (!user) {
    await auditLoginFailure('unknown_admin')
    throw createError({ statusCode: 401, message: locale === 'zh' ? '管理员不存在' : 'Admin not found' })
  }

  // 2. 验证密码 (使用 nuxt-auth-utils 内置的高性能验证)
  const isValid = await verifyPassword(user.passwordHash, password)
  if (!isValid) {
    await auditLoginFailure('bad_password', { id: user.id, username: user.username })
    throw createError({ statusCode: 401, message: locale === 'zh' ? '登录凭据无效' : 'Invalid credentials' })
  }

  // 3. 设置用户会话 (取代 jwt.sign)
  // 这会自动创建一个加密的 HttpOnly Cookie，存储在浏览器中
  const permsRaw = (user as any).permissions
  const permissions = Array.isArray(permsRaw) ? permsRaw : undefined

  await setUserSession(event, {
    admin: {
      id: user.id,
      username: user.username,
      role: 'admin',
      permissions,
    },
    user: undefined,
    loggedInAt: new Date()
  })

  await recordOperationFromEvent(event, {
    actorId: user.id,
    actorName: user.username,
    action: 'login',
    resource: 'auth',
    statusCode: 200,
  })

  return { message: locale === 'zh' ? '登录成功' : 'Login successful' }
})
