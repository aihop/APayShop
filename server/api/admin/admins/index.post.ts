import { admins } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        required: '用户名和密码不能为空',
        usernameExists: '用户名已存在',
        created: '管理员创建成功',
        failed: '创建管理员失败',
      }
    : {
        required: 'Username and password are required',
        usernameExists: 'Username already exists',
        created: 'Admin created successfully',
        failed: 'Failed to create admin',
      }
  try {
    const body = await readBody(event)
    const { username, password } = body
    
    if (!username || !password) {
      throw createError({
        statusCode: 400,
        message: messages.required
      })
    }
    
    // Check if admin already exists
    const existingAdmin = await db.select().from(admins).where(eq(admins.username, username))
    if (existingAdmin.length > 0) {
      throw createError({
        statusCode: 400,
        message: messages.usernameExists
      })
    }
    
    const hashedPassword = await hashPassword(password)
    
    await db.insert(admins).values({
      username,
      passwordHash: hashedPassword
    })
    
    return { code: 0, message: messages.created }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || messages.failed
    })
  }
})
