import { listMasterAgentTeamOrders } from '../../../promo/service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const masterAgentUserId = Number(query.masterAgentUserId || 0)
  const limit = Math.min(Number(query.limit || 100), 200)

  if (!masterAgentUserId) {
    return []
  }

  return listMasterAgentTeamOrders(masterAgentUserId, limit)
})
