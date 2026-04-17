import { orders } from "../../../db/schema"
import { desc, sql, eq } from "drizzle-orm"
import { db } from '@nuxthub/db'
import { ORDER_PAY_STATUS } from "~~/server/utils/constants"

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const pageSize = parseInt(query.pageSize as string) || 15
    const offset = (page - 1) * pageSize

    // 由于 customers 数据是聚合查询（包括具名邮箱和匿名访客两部分），
    // 要在数据库层面实现精确的全局分页比较复杂。
    // 因此这里我们先查出所有的聚合结果，然后在内存中进行分页切片。
    // 这对于管理后台的客户列表来说性能通常是可以接受的。

    const data = await db.select({
      email: orders.contactEmail,
      visitorId: sql<string>`MAX(${orders.visitorId})`, 
      totalOrders: sql<number>`COUNT(${orders.id})`,
      totalSpent: sql<number>`SUM(CASE WHEN ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} THEN ${orders.amount} ELSE 0 END)`,
      firstOrderAt: sql<number>`MIN(${orders.createdAt})`,
      lastOrderAt: sql<number>`MAX(${orders.createdAt})`,
      unpaidOrders: sql<number>`SUM(CASE WHEN ${orders.payStatus} != ${ORDER_PAY_STATUS.PAID} THEN 1 ELSE 0 END)`,
    })
    .from(orders)
    .where(sql`${orders.contactEmail} IS NOT NULL AND ${orders.contactEmail} != ''`)
    .groupBy(orders.contactEmail)
    
    const anonymousData = await db.select({
      email: sql<string>`'Anonymous'`,
      visitorId: orders.visitorId,
      totalOrders: sql<number>`COUNT(${orders.id})`,
      totalSpent: sql<number>`SUM(CASE WHEN ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} THEN ${orders.amount} ELSE 0 END)`,
      firstOrderAt: sql<number>`MIN(${orders.createdAt})`,
      lastOrderAt: sql<number>`MAX(${orders.createdAt})`,
      unpaidOrders: sql<number>`SUM(CASE WHEN ${orders.payStatus} != ${ORDER_PAY_STATUS.PAID} THEN 1 ELSE 0 END)`,
    })
    .from(orders)
    .where(sql`(${orders.contactEmail} IS NULL OR ${orders.contactEmail} = '') AND ${orders.visitorId} IS NOT NULL`)
    .groupBy(orders.visitorId)

    // 合并并排序
    const combinedData = [...data, ...anonymousData].sort((a, b) => {
      const dateA = Number(a.lastOrderAt || 0)
      const dateB = Number(b.lastOrderAt || 0)
      return dateB - dateA
    })

    const total = combinedData.length
    const paginatedData = combinedData.slice(offset, offset + pageSize)

    return {
      data: paginatedData,
      total,
      page,
      pageSize
    }
  } catch (error: any) {
    console.error("Fetch customers error:", error)
    throw createError({
      statusCode: 500,
      message: error.message || "Failed to fetch customers"
    })
  }
})
