import { listPromoAgentRelations } from '../../../promo/service'

export default defineEventHandler(async () => {
  return listPromoAgentRelations(200)
})
