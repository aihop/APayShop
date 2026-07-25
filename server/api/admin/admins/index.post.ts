import { admins } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { normalizePermissions } from '../../../utils/adminPermissions'
import { setAuditMeta } from '../../../utils/auditLog'

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
    const { username, password, permissions } = body
    
    if (!username || !password) {
      throw createError({
        statusCode: 400,
        message: messages.required
      })
    }
    
    const existingAdmin = await db.select().from(admins).where(eq(admins.username, username))
    if (existingAdmin.length > 0) {
      throw createError({
        statusCode: 400,
        message: messages.usernameExists
      })
    }
    
    const hashedPassword = await hashPassword(password)
    // A newly created admin defaults to no access unless permissions are
    // explicitly provided ('*' for full access, or a list of codes).
    const normalizedPerms = normalizePermissions(permissions, { allowAll: true }) ?? []

    await db.insert(admins).values({
      username,
      passwordHash: hashedPassword,
      permissions: normalizedPerms,
    })

    setAuditMeta(event, {
      summary: `Created admin "${username}"`,
      details: { username, permissions: normalizedPerms },
    })

    return { code: 0, message: messages.created }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || messages.failed
    })
  }
})
