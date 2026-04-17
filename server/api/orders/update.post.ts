import { orders } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { orderId, tradeNo, payMethod } = body

    // Auth & Identity checks for security
    const session = await getUserSession(event)
    const userId = (session?.user as any)?.id
    const visitorId = getCookie(event, 'visitor_id')
    if (!userId && !visitorId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized: No user session or visitor cookie found'
      })
    }
  
    if (!orderId || !tradeNo) {
      return { code: 1, message: "Order ID and Trade No are required" }
    }
    await db.update(orders)
      .set({ tradeNo: tradeNo, payMethod: payMethod })
      .where(eq(orders.id, orderId))
      
    return { code: 0, message: "success" }
  } catch (error: any) {
    return { code: 1, message: error.message || "Internal server error" }
  }
})
