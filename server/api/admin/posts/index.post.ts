import { posts } from "../../../db/schema"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (!body.title || !body.slug) {
    throw createError({ statusCode: 400, message: "Title and slug are required" })
  }

  try {
    const postData = {
      title: body.title,
      slug: body.slug,
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
    return { code: 0, message: "Post created successfully", data: result[0] }
  } catch (error: any) {
    console.error('Create post error:', error)
    if (error.message?.includes('UNIQUE constraint failed')) {
      return { code: 1, message: "A post with this slug already exists" }
    }
    return { code: 1, message: error.message || "Internal server error" }
  }
})
