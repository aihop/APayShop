import { products } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

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
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Missing id" })
  
  if (event.method === "PUT") {
    const body = await readBody(event)
    
    // Create a copy of the body without undefined/null properties that would cause sqlite errors
    // also remove createdAt as it should not be updated
    const updateData = { ...body }
    delete updateData.id // don't update ID
    delete updateData.createdAt // don't update creation time
    
    if (!updateData.slug && updateData.name) {
      updateData.slug = updateData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    }

    updateData.imageUrls = normalizeImageUrls(updateData.imageUrls)
    updateData.metaData = normalizeMetaData(updateData.metaData)
    
    // SQLite doesn't like null values for string columns sometimes or missing fields
    // Ensure all undefined values are stripped out
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key]
      }
    })
    
    return await db.update(products).set(updateData).where(eq(products.id, parseInt(id))).returning()
  }
  
  if (event.method === "DELETE") {
    await db.delete(products).where(eq(products.id, parseInt(id)))
    return { success: true }
  }
})
