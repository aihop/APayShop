import { users } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { validateEmail } from '../../../utils/emailValidation'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        required: '邮箱和密码不能为空',
        invalidEmail: '请输入有效的电子邮箱地址',
        emailExists: '邮箱已存在',
        created: '用户创建成功',
        failed: '创建用户失败',
      }
    : {
        required: 'Email and password are required',
        invalidEmail: 'Please enter a valid email address',
        emailExists: 'Email already exists',
        created: 'User created successfully',
        failed: 'Failed to create user',
      }
  try {
    const body = await readBody(event)
    const { username, password } = body

    const rawEmail = String(username || '').trim()

    if (!rawEmail || !password) {
      throw createError({
        statusCode: 400,
        message: messages.required,
      })
    }

    const validation = validateEmail(rawEmail)
    if (!validation.valid) {
      throw createError({
        statusCode: 400,
        message: messages.invalidEmail,
      })
    }

    const email = validation.normalizedEmail!

    const existingUser = await db.select().from(users).where(eq(users.email, email))
    if (existingUser.length > 0) {
      throw createError({
        statusCode: 400,
        message: messages.emailExists,
      })
    }

    const passwordHash = await hashPassword(password)

    await db.insert(users).values({
      email,
      passwordHash,
      nickname: email.split('@')[0] || email,
    })

    return { code: 0, message: messages.created }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || messages.failed,
    })
  }
})
