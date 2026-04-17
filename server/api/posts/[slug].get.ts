import { posts } from "../../db/schema"
import { eq, and, sql } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineCachedEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug")
  
  if (!slug) {
    throw createError({ statusCode: 400, message: "Missing post slug" })
  }

  const postList = await db.select().from(posts).where(and(eq(posts.slug, slug), eq(posts.isActive, true))).limit(1)
  const post = postList[0]

  if (!post) {
    throw createError({ statusCode: 404, message: "Post not found" })
  }

  // Increment view count asynchronously
  // Note: Since this endpoint is cached (maxAge: 60s), this will only increment
  // on a cache miss.
  event.waitUntil(
    db.update(posts)
      .set({ views: sql`${posts.views} + 1` })
      .where(eq(posts.id, post.id))
      .execute()
      .catch(err => console.error('Failed to increment post views:', err))
  )

  let parsedMetaData = null
  if (post.metaData) {
    try {
      parsedMetaData = typeof post.metaData === 'string' 
        ? JSON.parse(post.metaData) 
        : post.metaData
    } catch (e) {
      console.error('Failed to parse metaData JSON', e)
    }
  }

  return {
    ...post,
    metaData: parsedMetaData
  }
}, {
  maxAge: 60, // 1 minute
  swr: true,
  name: 'post-detail',
  getKey: (event) => getRouterParam(event, "slug") || 'unknown'
})
