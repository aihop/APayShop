import type { H3Event } from 'h3'
import { and, eq, or } from 'drizzle-orm'
import { orders } from '../db/schema'
import { db } from '../db/runtime'
import { getRequestLocale } from './requestLocale'

/**
 * 订单归属校验:凡是"按 orderId 读/写订单"的面向客户端接口都必须走这里,
 * 只知道订单号不代表有权操作(IDOR 防线)。
 * - 登录用户:匹配 orders.userId,或该会话自己的 visitorId(登录前下的单)
 * - 匿名用户:仅匹配 visitor_id cookie
 * 不匹配统一 404,不向探测者泄露订单是否存在。
 */
export const requireOrderOwnership = async (event: H3Event, orderId: string) => {
  const locale = getRequestLocale(event)
  const session = await getUserSession(event)
  const userId = (session?.user as any)?.id
  const visitorId = getCookie(event, 'visitor_id')

  if (!userId && !visitorId) {
    throw createError({
      statusCode: 401,
      message: locale === 'zh' ? '未登录，且未找到访客凭证' : 'Unauthorized: No user session or visitor cookie found',
    })
  }

  const authCondition = userId
    ? or(eq(orders.userId, userId), eq(orders.visitorId, visitorId || ''))
    : eq(orders.visitorId, visitorId as string)

  const rows = await db.select().from(orders)
    .where(and(eq(orders.id, orderId), authCondition))
    .limit(1)

  if (!rows.length || !rows[0]) {
    throw createError({ statusCode: 404, message: locale === 'zh' ? '订单不存在' : 'Order not found' })
  }
  return rows[0]
}
