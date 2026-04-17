import { posts } from "../../db/schema"
import { desc, eq, and, count } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const type = query.type as string || 'blog'
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 12
  const offset = (page - 1) * pageSize

  const totalResult = await db.select({ value: count() })
    .from(posts)
    .where(and(eq(posts.isActive, true), eq(posts.type, type)))
  const total = totalResult[0]?.value || 0
  
  const result = await db.select({
    id: posts.id,
    slug: posts.slug,
    title: posts.title,
    description: posts.description,
    imageUrl: posts.imageUrl,
    type: posts.type,
    views: posts.views,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    metaData: posts.metaData
  })
  .from(posts)
  .where(and(eq(posts.isActive, true), eq(posts.type, type)))
  .orderBy(desc(posts.createdAt))
  .limit(pageSize)
  .offset(offset)

  return {
    data: result,
    total,
    page,
    pageSize
  }
}, {
  maxAge: 60, // cache for 60 seconds
  swr: true,
  name: 'posts-list',
  getKey: (event) => {
    const query = getQuery(event)
    return `posts-${query.type || 'blog'}-page-${query.page || 1}-size-${query.pageSize || 12}`
  }
})
