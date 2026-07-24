import { posts } from "../../../db/schema"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const body = await readBody(event)
  
  if (!body.title || !body.slug) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '标题和 slug 不能为空' : 'Title and slug are required' })
  }

  try {
    const normalizedKey = typeof body.key === 'string' ? body.key.trim() : ''
    const normalizedSort = (body.sort === '' || body.sort === null || body.sort === undefined)
      ? null
      : (Number.isFinite(Number(body.sort)) ? Number(body.sort) : null)
    const postData = {
      title: body.title,
      slug: body.slug,
      key: normalizedKey || null,
      sort: normalizedSort,
      description: body.description || null,
      content: body.content || null,
      type: body.type || 'blog',
      imageUrl: body.imageUrl || null,
      isActive: body.isActive !== undefined ? body.isActive : true,
      metaData: body.metaData ? (process.env.NUXT_HUB_DATABASE ? body.metaData : JSON.stringify(body.metaData)) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await db.insert(posts).values(postData).returning()
    return { code: 0, message: locale === 'zh' ? '文章创建成功' : 'Post created successfully', data: result[0] }
  } catch (error: any) {
    console.error('Create post error:', error)
    const msg = String(error?.message || '')
    const pgCode = String(error?.code || '')
    if (msg.includes('UNIQUE constraint failed') || pgCode === '23505') {
      if (msg.includes('posts.slug') || msg.includes('posts_slug') || msg.includes('posts_slug_key')) {
        return { code: 1, message: locale === 'zh' ? '该 slug 的文章已存在' : 'A post with this slug already exists' }
      }
      return { code: 1, message: locale === 'zh' ? '存在重复约束' : 'Duplicate constraint' }
    }
    return { code: 1, message: error.message || (locale === 'zh' ? '服务器内部错误' : 'Internal server error') }
  }
})
