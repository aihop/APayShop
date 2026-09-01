import { posts } from "../../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../../db/runtime'
import { getRequestLocale } from '../../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const idStr = getRouterParam(event, "id")
  const id = parseInt(idStr || '')
  if (!id) throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少文章 ID' : 'Missing post id' })

  const body = await readBody(event)
  if (typeof body?.isActive !== 'boolean') {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少状态参数' : 'isActive must be a boolean' })
  }

  const updated = await db.update(posts)
    .set({
      isActive: body.isActive,
      updatedAt: new Date()
    })
    .where(eq(posts.id, id))
    .returning()

  if (updated.length === 0) {
    throw createError({ statusCode: 404, message: locale === 'zh' ? '文章不存在' : 'Post not found' })
  }

  return {
    code: 0,
    message: locale === 'zh' ? '状态更新成功' : 'Status updated successfully',
    data: updated[0]
  }
})
