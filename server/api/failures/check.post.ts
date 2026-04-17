import { failures } from "../../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { cardBin } = body
    const visitorId = getCookie(event, 'visitor_id') || 'unknown'
    
    if (!cardBin) {
      return { code: 1, message: "Card bin is required" }
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
      return { code: 1, message: "Card bin already checked" }
    } else {
      return { 
        code: 0, 
        message: "success" 
      }
    }
    
  } catch (error: any) {
    console.error('Check bin error:', error)
    return { code: 1, message: error.message || "Internal server error" }
  }
})