import { db } from '@nuxthub/db'
import { orders, apiKeys } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { ORDER_STATUS } from '../../utils/constants'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  // 1. 安全校验：只允许带正确 CRON_SECRET 的请求，或者在本地开发环境中允许
  const config = useRuntimeConfig()
  const authHeader = getHeader(event, 'Authorization')
  const cronSecret = config.cronSecret || process.env.CRON_SECRET

  // 如果配置了 CRON_SECRET，则必须匹配
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    await logger.warn('[Cron] Unauthorized attempt to trigger subscriptions cron')
    return createError({ statusCode: 401, message: 'Unauthorized' })
  }

  await logger.info('[Cron] Starting to process subscriptions...')
  const now = new Date()
  let processedCount = 0
  let expiredCount = 0
  let errorCount = 0

  try {
    // 2. 查出所有当前处于 ACTIVE 状态的订单
    const activeOrders = await db.select().from(orders).where(eq(orders.status, ORDER_STATUS.ACTIVE))

    for (const order of activeOrders) {
      try {
        // 提取订单的 metaData
        const metaData = order.metaData as any || {}
        
        // 检查是否有 expire_at 字段
        if (metaData.expire_at) {
          const expireAt = new Date(metaData.expire_at)

          // 3. 判断是否已经过期
          if (now > expireAt) {
            // 标记为已过期
            await db.update(orders)
              .set({ status: ORDER_STATUS.EXPIRED })
              .where(eq(orders.id, order.id))
            
            // 如果这个订单关联了 API Key（针对动态 API 额度业务），需要同时把 Key 禁用
            await db.update(apiKeys)
              .set({ status: 0 }) // 0 表示禁用
              .where(eq(apiKeys.orderId, order.id))
            
            await logger.info(`[Cron] Subscription ${order.id} expired.`)
            expiredCount++

            // 注意：如果你后续集成了 Stripe / PayPal 的"自动代扣" (Reference Transaction / Vault)，
            // 你应该在这里先发起扣款请求。如果扣款成功，则更新 expire_at；如果扣款失败，再走上面这段过期逻辑。
            // 目前我们的架构是基于网关自动扣费并通过 Webhook 推送，所以这里只处理“网关没推成功/没续费导致真的过期了”的兜底逻辑。
          }
        }
        processedCount++
      } catch (err: any) {
        errorCount++
        await logger.error(`[Cron] Error processing subscription ${order.id}`, { error: err.message })
      }
    }

    await logger.info('[Cron] Subscriptions processing completed', {
      processed: processedCount,
      expired: expiredCount,
      errors: errorCount
    })

    return {
      code: 0,
      message: 'Success',
      data: {
        processed: processedCount,
        expired: expiredCount,
        errors: errorCount,
        timestamp: now.toISOString()
      }
    }
  } catch (error: any) {
    await logger.error('[Cron] Fatal error in process-subscriptions', { error: error.message })
    return createError({ statusCode: 500, message: 'Internal Server Error' })
  }
})
