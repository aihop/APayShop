import { approvePendingPromoAgentRelation, rejectPendingPromoAgentRelation } from '../../../../promo/service'

export default defineEventHandler(async (event) => {
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const relationId = Number(getRouterParam(event, 'id') || 0)
  const body = await readBody(event)
  const action = String(body?.action || '').trim().toLowerCase()

  if (!relationId) {
    throw createError({ statusCode: 400, message: 'Relation ID is required' })
  }

  if (action === 'approve') {
    return approvePendingPromoAgentRelation({
      relationId,
      masterAgentUserId: session.user.id,
    })
  }

  if (action === 'reject') {
    return rejectPendingPromoAgentRelation({
      relationId,
      masterAgentUserId: session.user.id,
    })
  }

  throw createError({ statusCode: 400, message: 'Invalid action' })
})
