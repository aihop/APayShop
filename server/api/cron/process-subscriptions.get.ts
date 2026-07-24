import { db } from '../../db/runtime'
import { orders, subscriptions } from '../../db/schema'
import { eq, and, lt } from 'drizzle-orm'
import { ORDER_STATUS } from '../../utils/constants'
import { logger } from '../../utils/logger'
import { getRequestLocale } from '../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  // 1. 安全校验:默认拒绝——未配置 CRON_SECRET 时不再放行(此前漏配即完全
  //    公开);仅本地开发环境允许免密触发
  const config = useRuntimeConfig()
  const authHeader = getHeader(event, 'Authorization')
  const cronSecret = String(config.cronSecret || process.env.CRON_SECRET || '').trim()
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    await logger.warn('[Cron] Unauthorized attempt to trigger subscriptions cron')
    // throw 而非 return:return createError 会把 error 对象当响应体吐出(内部结构泄露),
    // throw 才走 h3 的错误响应路径
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未授权' : 'Unauthorized' })
  }

  await logger.info('[Cron] Starting to process subscriptions...')
  const now = new Date()
  let expiredCount = 0
  let errorCount = 0

  try {
    // 2. 权威数据源是 subscriptions.currentPeriodEnd(履约写入的就是它)。
    //    旧实现读 orders.metaData.expire_at——全仓没有任何写入方,是永远
    //    命中不了的死逻辑,正常订阅从不会被标过期。
    const dueSubscriptions = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.status, 'active'), lt(subscriptions.currentPeriodEnd, now)))

    for (const sub of dueSubscriptions) {
      try {
        await db.update(subscriptions)
          .set({ status: 'expired', updatedAt: now })
          .where(eq(subscriptions.id, sub.id))

        // 关联订单同步置为过期(只动仍在生效中的)
        await db.update(orders)
          .set({ status: ORDER_STATUS.EXPIRED })
          .where(and(eq(orders.subscriptionId, sub.id), eq(orders.status, ORDER_STATUS.ACTIVE)))

        await logger.info(`[Cron] Subscription ${sub.id} expired.`)
        expiredCount++
      } catch (err: any) {
        errorCount++
        await logger.error(`[Cron] Error processing subscription ${sub.id}`, { source: 'cron', details: { error: err.message } })
      }
    }

    await logger.info('[Cron] Subscriptions processing completed', {
      source: 'cron',
      details: {
        processed: dueSubscriptions.length,
        expired: expiredCount,
        errors: errorCount
      }
    })

    return {
      code: 0,
      message: locale === 'zh' ? '成功' : 'Success',
      data: {
        processed: dueSubscriptions.length,
        expired: expiredCount,
        errors: errorCount,
        timestamp: now.toISOString()
      }
    }
  } catch (error: any) {
    await logger.error('[Cron] Fatal error in process-subscriptions', { source: 'cron', details: { error: error.message } })
    throw createError({ statusCode: 500, message: locale === 'zh' ? '服务器内部错误' : 'Internal Server Error' })
  }
})
