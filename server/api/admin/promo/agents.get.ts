import { count } from 'drizzle-orm'
import { promoMembers } from '../../../db/schema'
import { db } from '../../../db/runtime'
import { listPromoAgents } from '../../../promo/service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 15

  const allAgents = await listPromoAgents(500)
  const totalRows = await db.select({ value: count() }).from(promoMembers)
  const total = Number(totalRows[0]?.value || 0)
  const start = (page - 1) * pageSize

  return {
    data: allAgents.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  }
})
