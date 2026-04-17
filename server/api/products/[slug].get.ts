import { products, cards } from "../../db/schema"
import { eq, sql } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineCachedEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug")
  
  if (!slug) {
    throw createError({ statusCode: 400, message: "Missing product slug" })
  }

  // Get product by slug instead of ID
  const productList = await db.select().from(products).where(eq(products.slug, slug)).limit(1)
  const product = productList[0]
  
  if (!product) {
    throw createError({ statusCode: 404, message: "Product not found" })
  }

  // Increment view count asynchronously
  // Note: Since this endpoint is cached (maxAge: 60s), this will only increment
  // on a cache miss. For exact real-time views, a separate POST endpoint is recommended.
  event.waitUntil(
    db.update(products)
      .set({ views: sql`${products.views} + 1` })
      .where(eq(products.id, product.id))
      .execute()
      .catch(err => console.error('Failed to increment product views:', err))
  )

  // Parse JSON string fields back to arrays/objects for the frontend
  let parsedImageUrls = []
  if (product.imageUrls) {
    try {
      parsedImageUrls = typeof product.imageUrls === 'string' 
        ? JSON.parse(product.imageUrls) 
        : product.imageUrls
    } catch (e) {
      console.error('Failed to parse imageUrls JSON', e)
    }
  }
  return {
    ...product,
    images: parsedImageUrls,
  }
}, {
  maxAge: 60, // 1 minute
  swr: true,
  name: 'product-detail',
  getKey: (event) => getRouterParam(event, "slug") || 'unknown'
})
