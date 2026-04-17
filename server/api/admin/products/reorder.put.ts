import { products } from "../../../db/schema"
import { db } from '@nuxthub/db'
import { eq } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const items = body.items

  if (!Array.isArray(items)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body, expected an array of items'
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