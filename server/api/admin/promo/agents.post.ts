import { eq } from 'drizzle-orm'
import { users } from '../../../db/schema'
import { db } from '../../../db/runtime'
import { assignPromoAgentByUserId } from '../../../promo/service'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const body = await readBody(event)
  const email = String(body?.email || '').trim().toLowerCase()
  const role = String(body?.role || 'agent').trim() as 'agent' | 'master_agent'
  const parentAgentUserId = Number(body?.parentAgentUserId || 0) || null

  if (!email) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '邮箱不能为空' : 'Email is required' })
  }

  if (role !== 'agent' && role !== 'master_agent') {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '角色无效' : 'Invalid role' })
  }

  const userRows = await db.select({
    id: users.id,
    email: users.email,
  }).from(users).where(eq(users.email, email)).limit(1)

  if (!userRows.length) {
    throw createError({ statusCode: 404, message: locale === 'zh' ? '用户不存在' : 'User not found' })
  }

  return assignPromoAgentByUserId({
    userId: userRows[0].id,
    role,
    parentAgentUserId,
  })
})
