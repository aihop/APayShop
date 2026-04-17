import { orders } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Missing id" })
  
  const body = await readBody(event)
  
  const updateData: any = {}
  if (body.status) updateData.status = body.status
  if (body.payStatus) updateData.payStatus = body.payStatus
  if (body.deliveryInfo !== undefined) updateData.deliveryInfo = body.deliveryInfo

  const result = await db.update(orders)
    .set(updateData)
    .where(eq(orders.id, id))
    .returning()
    
  return result[0]
})