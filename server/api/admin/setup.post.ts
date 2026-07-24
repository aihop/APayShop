import { admins } from "../../db/schema"
import { db } from '../../db/runtime'
import { getRequestLocale } from '../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const existingUsers = await db.select().from(admins).limit(1)
  
  if (existingUsers.length > 0) {
    throw createError({ statusCode: 403, message: locale === 'zh' ? '管理员已初始化' : 'Admin already initialized' })
  }
  
  const body = await readBody(event)
  const { username, password } = body
  
  if (!username || !password) throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少登录凭据' : 'Missing credentials' })
  
  const passwordHash = await hashPassword(password)
  
  await db.insert(admins).values({
    username,
    passwordHash: passwordHash
  })
  
  return { success: true, message: locale === 'zh' ? '管理员初始化完成' : 'Admin initialized' }
})
