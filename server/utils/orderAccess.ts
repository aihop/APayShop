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
  let visitorId = getCookie(event, 'visitor_id')

  const normalizedOrderId = String(orderId || '').trim()
  if (!normalizedOrderId) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少订单 ID' : 'Missing order id' })
  }

  const idCondition = or(eq(orders.id, normalizedOrderId), eq(orders.externalOrderId, normalizedOrderId))

  // 1. 若有登录态或访客 Cookie，先执行严格所有权查询
  if (userId || visitorId) {
    const authCondition = userId
      ? or(eq(orders.userId, userId), eq(orders.visitorId, visitorId || ''))
      : eq(orders.visitorId, visitorId as string)

    const rows = await db.select().from(orders)
      .where(and(idCondition, authCondition))
      .limit(1)

    if (rows.length && rows[0]) {
      return rows[0]
    }
  }

  // 2. 收银台与订单支付查询放行 (支持小程序 webview / 跨站 iframe / 外部支付回调后直接打开支付链接场景)
  const orderRows = await db.select().from(orders)
    .where(idCondition)
    .limit(1)

  if (orderRows.length && orderRows[0]) {
    const targetOrder = orderRows[0]
    
    // 如果是当前用户登录且订单属于其他用户，做越权拦截
    if (userId && targetOrder.userId && Number(userId) !== Number(targetOrder.userId)) {
      throw createError({ statusCode: 403, message: locale === 'zh' ? '无权访问该订单' : 'Forbidden: Order belongs to another user' })
    }

    // 匿名/未登录或通过唯一高熵订单号直接访问支付链接：放行并自动补齐访客 Cookie
    if (targetOrder.visitorId && !visitorId) {
      try {
        setCookie(event, 'visitor_id', String(targetOrder.visitorId), {
          maxAge: 31536000,
          path: '/',
          sameSite: 'none',
          secure: true,
        })
      } catch {}
    }
    return targetOrder
  }

  throw createError({ statusCode: 404, message: locale === 'zh' ? '订单不存在' : 'Order not found' })
}
