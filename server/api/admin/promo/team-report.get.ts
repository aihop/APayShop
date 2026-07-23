import { getMasterAgentTeamReport } from '../../../promo/service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const masterAgentUserId = Number(query.masterAgentUserId || 0)

  if (!masterAgentUserId) {
    return {
      summary: {
        teamCount: 0,
        paidOrderCount: 0,
        totalSalesAmount: 0,
        totalCommissionAmount: 0,
      },
      rows: [],
    }
  }

  return getMasterAgentTeamReport(masterAgentUserId)
})
