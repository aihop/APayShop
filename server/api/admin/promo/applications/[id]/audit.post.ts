import { eq } from 'drizzle-orm'
import { db } from '../../../../../db/runtime'
import { promoApplications } from '../../../../../db/schema'
import { ensurePromoMember } from '../../../../../promo/service'
import { PROMO_ROLE } from '../../../../../promo/utils'

export default defineEventHandler(async (event) => {
  const adminSession: any = await requireAdminSession(event)
  const adminId = Number(adminSession?.user?.id || 0) || null
  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: 'Invalid application ID' })
  }

  const body = await readBody(event)
  const action = String(body?.action || '').trim().toLowerCase() // 'approve' | 'reject'
  const reviewNote = String(body?.reviewNote || '').trim()

  if (action !== 'approve' && action !== 'reject') {
    throw createError({ statusCode: 400, message: 'Action must be approve or reject' })
  }

  const rows = await db.select().from(promoApplications).where(eq(promoApplications.id, id)).limit(1)
  if (rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Application not found' })
  }
  const app = rows[0]

  const nextStatus = action === 'approve' ? 'approved' : 'rejected'
  const now = new Date()

  await db.update(promoApplications)
    .set({
      status: nextStatus,
      reviewNote: reviewNote || null,
      reviewedByAdminId: adminId,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(promoApplications.id, id))

  if (action === 'approve') {
    await ensurePromoMember(app.userId, PROMO_ROLE.MEMBER)
  }

  return {
    ok: true,
    status: nextStatus,
    message: action === 'approve' ? '已审核通过并激活推广权限' : '已驳回申请',
  }
})
