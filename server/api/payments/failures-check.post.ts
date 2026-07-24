import { failures } from "../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from '../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        cardBinRequired: '卡 bin 不能为空',
        alreadyChecked: '该卡 bin 已检查过',
        success: '成功',
        internalError: '服务器内部错误',
      }
    : {
        cardBinRequired: 'Card bin is required',
        alreadyChecked: 'Card bin already checked',
        success: 'success',
        internalError: 'Internal server error',
      }
  try {
    const body = await readBody(event)
    const { cardBin } = body
    const visitorId = getCookie(event, 'visitor_id') || 'unknown'
    
    if (!cardBin) {
      return { code: 1, message: messages.cardBinRequired }
    }

    // 查询数据库中是否存在该bin的记录
    const existingRecord = await db.select()
      .from(failures)
      .where(
        and(
          eq(failures.cardBin, cardBin),
          eq(failures.visitorId, visitorId)
        )
      )
    
    if (existingRecord.length > 0) {
      return { code: 1, message: messages.alreadyChecked }
    } else {
      return { 
        code: 0, 
        message: messages.success
      }
    }
    
  } catch (error: any) {
    console.error('Check bin error:', error)
    return { code: 1, message: error.message || messages.internalError }
  }
})
