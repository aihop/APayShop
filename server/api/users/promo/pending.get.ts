import { listPendingPromoAgentRelations } from '../../../promo/service'

export default defineEventHandler(async (event) => {
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit || 100), 200)
  return listPendingPromoAgentRelations(session.user.id, limit)
})
