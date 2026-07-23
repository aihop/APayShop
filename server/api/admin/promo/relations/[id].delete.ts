import { disablePromoAgentRelation } from '../../../../promo/service'

export default defineEventHandler(async (event) => {
  const relationId = Number(getRouterParam(event, 'id') || 0)
  return disablePromoAgentRelation(relationId)
})
