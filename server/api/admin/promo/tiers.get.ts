import { desc } from 'drizzle-orm'
import { promoAgentTiers } from '../../../db/schema'
import { db } from '../../../db/runtime'

export default defineEventHandler(async () => {
  return db.select().from(promoAgentTiers).orderBy(desc(promoAgentTiers.roleScope), desc(promoAgentTiers.level))
})
