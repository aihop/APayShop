import { posts } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Missing id" })

  const body = await readBody(event)
  
  if (!body.title || !body.slug) {
    throw createError({ statusCode: 400, message: "Title and slug are required" })
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
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined, // 处理跨数据库布尔值
      metaData: body.metaData ? (process.env.NUXT_HUB_DATABASE ? body.metaData : JSON.stringify(body.metaData)) : null,
      updatedAt: new Date()
    }

    const result = await db.update(posts)
      .set(postData)
      .where(eq(posts.id, parseInt(id)))
      .returning()

    return { code: 0, message: "Post updated successfully", data: result[0] }
  } catch (error: any) {
    console.error('Update post error:', error)
    const msg = String(error?.message || '')
    const pgCode = String(error?.code || '')
    if (msg.includes('UNIQUE constraint failed') || pgCode === '23505') {
      if (msg.includes('posts.slug') || msg.includes('posts_slug') || msg.includes('posts_slug_key')) {
        return { code: 1, message: "A post with this slug already exists" }
      }
      return { code: 1, message: "Duplicate constraint" }
    }
    return { code: 1, message: error.message || "Internal server error" }
  }
})
