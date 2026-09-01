import { products } from "../../../db/schema"
import { db } from '../../../db/runtime'
import { and, count, desc, like, or, sql } from "drizzle-orm"
import { getRequestLocale } from '../../../utils/requestLocale'

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
    const search = String(query.search || '').trim()
    const type = String(query.type || '').trim()
    const offset = (page - 1) * pageSize

    const conditions = []
    if (search) {
      conditions.push(or(
        like(products.name, `%${search}%`),
        like(products.description, `%${search}%`),
        like(products.slug, `%${search}%`),
      ))
    }
    if (type && type !== 'all') {
      conditions.push(sql`${products.type} = ${type}`)
    }

    const whereClause = conditions.length === 1
      ? conditions[0]
      : conditions.length > 1
        ? and(...conditions)
        : undefined

    let countQuery = db.select({ value: count() }).from(products)
    if (whereClause) {
      countQuery = countQuery.where(whereClause) as any
    }
    const totalResult = await countQuery
    const total = totalResult[0]?.value || 0

    let selectQuery = db.select()
      .from(products)
      .orderBy(products.sortOrder, desc(products.id))
      .limit(pageSize)
      .offset(offset)
    if (whereClause) {
      selectQuery = selectQuery.where(whereClause) as any
    }
    const result = await selectQuery

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

    // price = 0 is intentional (free/promo products skip the payment gateway
    // and auto-fulfill — see server/api/orders/checkout.post.ts). A negative
    // price has no legitimate use and was previously unchecked: any visitor
    // could discover a mispriced product and farm free fulfillments from it.
    if (insertData.price !== undefined) {
      const price = Number(insertData.price)
      if (!Number.isFinite(price) || price < 0) {
        throw createError({
          statusCode: 400,
          message: getRequestLocale(event) === 'zh' ? '价格不能为负数' : 'Price cannot be negative',
        })
      }
    }

    if (!insertData.slug && insertData.name) {
      insertData.slug = insertData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    }

    insertData.imageUrls = normalizeImageUrls(insertData.imageUrls)
    insertData.metaData = normalizeMetaData(insertData.metaData)

    if (insertData.status) {
      insertData.isActive = insertData.status !== 'inactive'
      delete insertData.status
    } else if (insertData.isActive !== undefined) {
      delete insertData.status
    } else {
      delete insertData.status
      insertData.isActive = true
    }

    // Clean up created_at to avoid timestamp/string mismatch in pg/sqlite
    if (insertData.createdAt) {
      delete insertData.createdAt
    }

    return await db.insert(products).values(insertData).returning()
  }
})
