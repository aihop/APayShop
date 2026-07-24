import { products } from "../../../db/schema"
import { db } from '../../../db/runtime'
import { eq } from "drizzle-orm"
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const body = await readBody(event)
  const items = body.items

  if (!Array.isArray(items)) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '请求体无效，预期为数组 items' : 'Invalid request body, expected an array of items'
    })
  }

  // Update sort order for each product
  // For SQLite/Postgres compatibility we do this sequentially
  const updates = []
  for (const item of items) {
    if (item.id !== undefined && item.sortOrder !== undefined) {
      updates.push(
        db.update(products)
          .set({ sortOrder: item.sortOrder })
          .where(eq(products.id, item.id))
      )
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates)
  }

  return { success: true, updated: updates.length }
})
