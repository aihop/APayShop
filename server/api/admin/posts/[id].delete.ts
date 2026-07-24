import { posts } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少 ID' : 'Missing id' })

  try {
    await db.delete(posts).where(eq(posts.id, parseInt(id)))
    return { code: 0, message: locale === 'zh' ? '文章删除成功' : 'Post deleted successfully' }
  } catch (error: any) {
    console.error('Delete post error:', error)
    return { code: 1, message: error.message || (locale === 'zh' ? '服务器内部错误' : 'Internal server error') }
  }
})
