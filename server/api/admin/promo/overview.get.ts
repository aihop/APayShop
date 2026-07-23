import { getPromoOverview, listPromoAgents, listPromoAttributions, listPromoCommissions } from '../../../promo/service'

export default defineEventHandler(async () => {
  const [overview, agents, attributions, commissions] = await Promise.all([
    getPromoOverview(),
    listPromoAgents(20),
    listPromoAttributions(20),
    listPromoCommissions(20),
  ])

  return {
    overview,
    agents,
    attributions,
    commissions,
  }
})
