import { logs } from "../../../db/schema"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  try {
    // Clear all logs
    await db.delete(logs)
    return { success: true, message: locale === 'zh' ? '日志已全部清空' : 'All logs cleared successfully' }
  } catch (error) {
    throw createError({ statusCode: 500, message: locale === 'zh' ? '清空日志失败' : 'Failed to clear logs' })
  }
})
