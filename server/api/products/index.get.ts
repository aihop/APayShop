import { products } from "../../db/schema"
import { eq, desc, count } from "drizzle-orm"
import { db } from '../../db/runtime'

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(parseInt(query.page as string) || 1, 1)
  // Default to a larger size for public storefront;公开接口设分页上限防大查询
  const pageSize = Math.min(Math.max(parseInt(query.pageSize as string) || 100, 1), 200)
  const offset = (page - 1) * pageSize

  const totalResult = await db.select({ value: count() }).from(products).where(eq(products.isActive, true))
  const total = totalResult[0]?.value || 0

  const result = await db.select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.sortOrder), desc(products.id))
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
  swr: true,  // serve stale content while revalidating
  name: 'products-list',
  getKey: (event) => {
    const query = getQuery(event)
    return `page-${query.page || 1}-size-${query.pageSize || 100}`
  }
})
