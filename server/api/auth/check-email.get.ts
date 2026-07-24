import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from "../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const { email } = query

  if (!email) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '邮箱不能为空' : 'Email is required'
    })
  }

  const existingUser = await db.select().from(users).where(eq(users.email, email as string)).limit(1)

  return {
    success: true,
    exists: existingUser.length > 0
  }
})
