import { failures } from "../../../db/schema"
import { desc } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)

  try {
    const data = await db.select()
      .from(failures)
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
