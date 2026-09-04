import { products } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { setAuditMeta } from '../../../utils/auditLog'

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
  const locale = getRequestLocale(event)
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少 ID' : 'Missing id' })
  
  if (event.method === "PUT") {
    const body = await readBody(event)
    
    // Create a copy of the body without undefined/null properties that would cause sqlite errors
    // also remove createdAt as it should not be updated
    const updateData = { ...body }
    delete updateData.id // don't update ID
    delete updateData.createdAt // don't update creation time

    // price = 0 is intentional (free/promo products skip the payment gateway
    // and auto-fulfill — see server/api/orders/checkout.post.ts). A negative
    // price has no legitimate use and was previously unchecked.
    if (updateData.price !== undefined) {
      const price = Number(updateData.price)
      if (!Number.isFinite(price) || price < 0) {
        throw createError({
          statusCode: 400,
          message: locale === 'zh' ? '价格不能为负数' : 'Price cannot be negative',
        })
      }
    }

    if (!updateData.slug && updateData.name) {
      updateData.slug = updateData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    }

    updateData.imageUrls = normalizeImageUrls(updateData.imageUrls)
    updateData.metaData = normalizeMetaData(updateData.metaData)
    
    if (updateData.status) {
      updateData.isActive = updateData.status !== 'inactive'
    } else if (updateData.isActive !== undefined) {
      updateData.status = updateData.isActive ? 'active' : 'inactive'
    }

    // SQLite doesn't like null values for string columns sometimes or missing fields
    // Ensure all undefined values are stripped out
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key]
      }
    })
    
    const [before] = await db.select({ name: products.name, price: products.price, isActive: products.isActive })
      .from(products).where(eq(products.id, parseInt(id))).limit(1)

    const updated = await db.update(products).set(updateData).where(eq(products.id, parseInt(id))).returning()

    setAuditMeta(event, {
      summary: `Updated product "${before?.name ?? id}"`,
      details: {
        before: before ?? null,
        after: { name: updateData.name, price: updateData.price, isActive: updateData.isActive },
      },
    })

    return updated
  }

  if (event.method === "DELETE") {
    const [before] = await db.select({ name: products.name, price: products.price })
      .from(products).where(eq(products.id, parseInt(id))).limit(1)

    await db.delete(products).where(eq(products.id, parseInt(id)))

    setAuditMeta(event, {
      summary: `Deleted product "${before?.name ?? id}"`,
      details: { before: before ?? null },
    })

    return { success: true }
  }
})
