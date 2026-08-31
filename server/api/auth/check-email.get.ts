import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from "../../utils/requestLocale"
import { validateEmail } from "../../utils/emailValidation"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const { email: rawEmail } = query

  if (!rawEmail || typeof rawEmail !== 'string') {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '邮箱不能为空' : 'Email is required'
    })
  }

  const validation = validateEmail(rawEmail)
  if (!validation.valid) {
    return {
      success: false,
      valid: false,
      exists: false,
      message: locale === 'zh' ? '邮箱格式无效' : 'Invalid email format',
    }
  }

  const email = validation.normalizedEmail!
  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1)

  return {
    success: true,
    valid: true,
    exists: existingUser.length > 0
  }
})
