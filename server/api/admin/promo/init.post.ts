import { ensureDefaultPromoTiers } from '../../../promo/service'

export default defineEventHandler(async () => {
  return ensureDefaultPromoTiers()
})
