import { updatePromoAgentRelation } from '../../../../promo/service'

export default defineEventHandler(async (event) => {
  const relationId = Number(getRouterParam(event, 'id') || 0)
  const body = await readBody(event)

  return updatePromoAgentRelation({
    relationId,
    parentAgentUserId: Number(body?.parentAgentUserId || 0),
  })
})
