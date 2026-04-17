import { eq, desc, and, gte, inArray, ne } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { users, orders, products } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session: any = await requireUserSession(event)
  if (!session || !session.user || !session.user.id) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }
  const userId = session.user.id

  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 15
  const offset = (page - 1) * limit

  // 1. Get user balance (divide by 10^8 since it's stored as BIGINT)
  const userRecord: any = await db.select().from(users as any).where(eq(users.id as any, userId)).limit(1)

  const cash = Number(userRecord[0]?.CashBalance || 0) / 100000000
  const grant = Number(userRecord[0]?.GrantBalance || 0) / 100000000
  const availableBalance = cash + grant

  // 2. Calculate 30D Spend from Orders (amount is real, so no division needed)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentOrders = await db.select({ amount: orders.amount as any }).from(orders as any)
    .where(and(
      eq(orders.userId as any, userId),
      eq(orders.payStatus as any, 'paid'),
      gte(orders.paidAt as any, thirtyDaysAgo)
    ))

  const monthlySpend = recentOrders.reduce((sum: number, order: any) => sum + Number(order.amount), 0)

  // 3. Get Order records
  const records = await db.select().from(orders as any)
    .where(and(
      eq(orders.userId as any, userId),
      eq(orders.payStatus as any, 'paid'),
      ne(orders.payStatus as any, 'refunded')
    ))
    .orderBy(desc(orders.createdAt as any))
    .limit(limit)
    .offset(offset)

  // 4. Manually fetch product details for these orders
  const productIds = [...new Set(records.map((r: any) => r.productId))]
  const productsList = productIds.length > 0 
    ? await db.select({ id: products.id as any, name: products.name as any, type: products.type as any }).from(products as any).where(inArray(products.id as any, productIds))
    : []
  
  const productMap = new Map(productsList.map((p: any) => [p.id, p]))

  // Format records for frontend
  const formattedRecords = records.map((order: any) => {
    const product: any = productMap.get(order.productId)
    let displayType = 'purchase'
    if (product?.type === 'subscription') displayType = 'subscription'
    if (product?.type === 'recharge') displayType = 'recharge'

    return {
      id: order.id,
      time: order.paidAt ? new Date(order.paidAt).toLocaleString() : new Date(order.createdAt).toLocaleString(),
      type: displayType,
      target: product?.name || 'Unknown Product',
      amount: Number(order.amount),
      status: order.payStatus // 'paid', 'pending', 'failed'
    }
  })

  // Count total for pagination
  const allUserOrders = await db.select({ id: orders.id as any }).from(orders as any).where(and(
    eq(orders.userId as any, userId),
    eq(orders.payStatus as any, 'paid'),
    ne(orders.payStatus as any, 'refunded')
  ))
  const total = allUserOrders.length

  return {
    wallet: {
      available: availableBalance,
      frozen: 0, // Not implemented in DB yet
      monthlySpend: monthlySpend
    },
    records: {
      list: formattedRecords,
      total: total
    }
  }
})