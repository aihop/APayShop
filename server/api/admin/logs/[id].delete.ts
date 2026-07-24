import { logs } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const id = getRouterParam(event, 'id')
  
  if (!id) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少日志 ID' : 'Missing log ID' })
  }

  try {
    await db.delete(logs).where(eq(logs.id, parseInt(id)))
    return { success: true }
  } catch (error) {
    throw createError({ statusCode: 500, message: locale === 'zh' ? '删除日志失败' : 'Failed to delete log' })
  }
})
