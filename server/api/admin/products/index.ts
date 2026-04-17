import { products } from "../../../db/schema"
import { db } from '@nuxthub/db'
import { count, desc } from "drizzle-orm"

const normalizeImageUrls = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return []
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return Array.isArray(value) ? value : []
}

const normalizeMetaData = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return {}
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  return value && typeof value === 'object' ? value : {}
}

export default defineEventHandler(async (event) => {
  
  if (event.method === "GET") {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const pageSize = parseInt(query.pageSize as string) || 15
    const offset = (page - 1) * pageSize

    // Get total count
    const totalResult = await db.select({ value: count() }).from(products)
    const total = totalResult[0]?.value || 0

    const result = await db.select()
      .from(products)
      .orderBy(products.sortOrder, desc(products.id))
      .limit(pageSize)
      .offset(offset)

    return {
      data: result,
      total,
      page,
      pageSize
    }
  }
  
  if (event.method === "POST") {
    const body = await readBody(event)
    // Remove id from body to let SQLite auto-increment
    const { id, ...insertData } = body

    if (!insertData.slug && insertData.name) {
      insertData.slug = insertData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    }

    insertData.imageUrls = normalizeImageUrls(insertData.imageUrls)
    insertData.metaData = normalizeMetaData(insertData.metaData)

    // Clean up created_at to avoid timestamp/string mismatch in pg/sqlite
    if (insertData.createdAt) {
      delete insertData.createdAt
    }

    return await db.insert(products).values(insertData).returning()
  }
})
