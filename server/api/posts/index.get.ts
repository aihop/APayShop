import { posts } from "../../db/schema"
import { desc, asc, eq, and, count } from "drizzle-orm"
import { db } from '../../db/runtime'

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const type = query.type as string || 'blog'
  const postKey = (query.key as string | undefined)?.trim()
  const order = query.order as string | undefined
  const page = Math.max(parseInt(query.page as string) || 1, 1)
  // 公开接口分页上限:防止客户端传超大 pageSize 形成大查询
  const pageSize = Math.min(Math.max(parseInt(query.pageSize as string) || 12, 1), 100)
  const offset = (page - 1) * pageSize

  const conditions = [eq(posts.isActive, true), eq(posts.type, type)]
  if (postKey) {
    conditions.push(eq(posts.key, postKey))
  }
  const whereClause = and(...conditions)

  const totalResult = await db.select({ value: count() })
    .from(posts)
    .where(whereClause)
  const total = totalResult[0]?.value || 0
  
  let orderClause = desc(posts.createdAt)
  if (order === 'sort_asc') {
    orderClause = asc(posts.sort)
  } else if (order === 'sort_desc') {
    orderClause = desc(posts.sort)
  } else if (order === 'asc') {
    orderClause = asc(posts.createdAt)
  }

  const result = await db.select({
    id: posts.id,
    key: posts.key,
    sort: posts.sort,
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
  .where(whereClause)
  .orderBy(orderClause)
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
    return `posts-${query.type || 'blog'}-k-${query.key || ''}-o-${query.order || ''}-page-${query.page || 1}-size-${query.pageSize || 12}`
  }
})
