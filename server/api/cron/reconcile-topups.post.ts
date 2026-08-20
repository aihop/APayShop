import { retryIncompleteTopups } from '../../utils/topupLedger'
import { logger } from '../../utils/logger'
import { getRequestLocale } from '../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const config = useRuntimeConfig(event)
  const authHeader = getHeader(event, 'Authorization')
  const cronSecret = String(config.cronSecret || process.env.CRON_SECRET || '').trim()
  const isDev = process.env.NODE_ENV === 'development'
  if (!isDev && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    await logger.warn('[Cron] Unauthorized top-up reconciliation attempt')
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未授权' : 'Unauthorized' })
  }
  const body: { limit?: number } = await readBody<{ limit?: number }>(event).catch(() => ({}))
  const report = await retryIncompleteTopups(body.limit)
  await logger.info('[Cron] Top-up reconciliation completed', { source: 'cron', details: report })
  return { code: 0, data: report }
})
