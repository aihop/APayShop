import { users } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../../../../db/runtime'
import { getRequestLocale } from '../../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '用户 ID 不能为空' : 'User ID is required' })
  }
  const userId = Number(id)
  const body = await readBody(event).catch(() => ({}))
  const verified = body?.verified !== false // 默认标记为已验证

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const user = userRows[0]
  if (!user) {
    throw createError({ statusCode: 404, message: locale === 'zh' ? '用户不存在' : 'User not found' })
  }

  const newVerifiedAt = verified ? new Date() : null

  await db
    .update(users)
    .set({ emailVerifiedAt: newVerifiedAt })
    .where(eq(users.id, userId))

  return {
    success: true,
    emailVerifiedAt: newVerifiedAt,
    message: verified
      ? (locale === 'zh' ? '已成功手动认证该用户邮箱' : 'User email verified successfully')
      : (locale === 'zh' ? '已撤销该用户邮箱验证' : 'User email verification revoked'),
  }
})
