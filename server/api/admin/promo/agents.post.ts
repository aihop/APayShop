import { eq } from 'drizzle-orm'
import { users } from '../../../db/schema'
import { db } from '../../../db/runtime'
import { assignPromoAgentByUserId } from '../../../promo/service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body?.email || '').trim().toLowerCase()
  const role = String(body?.role || 'agent').trim() as 'agent' | 'master_agent'
  const parentAgentUserId = Number(body?.parentAgentUserId || 0) || null

  if (!email) {
    throw createError({ statusCode: 400, message: 'Email is required' })
  }

  if (role !== 'agent' && role !== 'master_agent') {
    throw createError({ statusCode: 400, message: 'Invalid role' })
  }

  const userRows = await db.select({
    id: users.id,
    email: users.email,
  }).from(users).where(eq(users.email, email)).limit(1)

  if (!userRows.length) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return assignPromoAgentByUserId({
    userId: userRows[0].id,
    role,
    parentAgentUserId,
  })
})
