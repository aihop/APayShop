import { failures, orders } from "../../../db/schema"
import { desc, eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)

  try {
    const data = await db.select({
      id: failures.id,
      orderId: failures.orderId,
      cardBin: failures.cardBin,
      reason: failures.reason,
      amount: failures.amount,
      currency: orders.currency,
      payMethod: failures.payMethod,
      contactEmail: failures.contactEmail,
      rawResponse: failures.rawResponse,
      visitorId: failures.visitorId,
      createdAt: failures.createdAt,
    })
      .from(failures)
      .leftJoin(orders, eq(failures.orderId, orders.id))
      .orderBy(desc(failures.createdAt))
      
    return data
  } catch (error: any) {
    console.error('Fetch failures error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || (locale === 'zh' ? '获取失败记录失败' : 'Failed to fetch failures')
    })
  }
})
