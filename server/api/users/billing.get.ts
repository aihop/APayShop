import { eq, desc, and, gte, inArray, ne } from 'drizzle-orm'
import { db } from '../../db/runtime'
import { userWallets, orders, products } from '../../db/schema'
import { getRequestLocale } from '../../utils/requestLocale'
import { aggregateOrderAccountingTotals } from '../../utils/orderCurrency'
import { toIsoTimestamp } from '../../utils/dbTime'
import { getOrCreateUserWallet } from '../../utils/userWallet'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  if (!session || !session.user || !session.user.id) {
    throw createError({
      statusCode: 401,
      message: locale === 'zh' ? '未登录' : 'Unauthorized'
    })
  }
  const userId = session.user.id

  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.pageSize as string) || 15
  const offset = (page - 1) * limit
  const tab = (query.tab as string) || 'pending'

  // 1. Get user balance (divide by 10^8 since it's stored as BIGINT)
  const walletRecord = await getOrCreateUserWallet(Number(userId))
  const userRecord: any = await db.select().from(userWallets as any).where(eq(userWallets.id as any, walletRecord.id)).limit(1)

  const cash = Number(userRecord[0]?.cashBalance || 0) / 100000000
  const grant = Number(userRecord[0]?.grantBalance || 0) / 100000000
  const availableBalance = cash + grant

  // 2. Calculate 30D Spend from Orders (amount is real, so no division needed)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentOrders = await db.select({
    amount: orders.amount as any,
    currency: orders.currency as any,
    metaData: orders.metaData as any,
  }).from(orders as any)
    .where(and(
      eq(orders.userId as any, userId),
      eq(orders.payStatus as any, 'paid'),
      gte(orders.paidAt as any, thirtyDaysAgo)
    ))

  const monthlySpendByCurrency = aggregateOrderAccountingTotals(recentOrders)
  const monthlySpend = monthlySpendByCurrency.length === 1 ? (monthlySpendByCurrency[0]?.amount || 0) : 0

  const wallet = {
    available: availableBalance,
    frozen: 0,
    monthlySpend: monthlySpend,
    monthlySpendByCurrency,
  }

  // 3. Determine payStatus filter based on tab
  const payStatusFilter = tab === 'pending' ? eq(orders.payStatus as any, 'pending') : and(
    eq(orders.payStatus as any, 'paid'),
    ne(orders.payStatus as any, 'refunded')
  )

  // 4. Get Order records
  const records = await db.select().from(orders as any)
    .where(and(
      eq(orders.userId as any, userId),
      payStatusFilter
    ))
    .orderBy(desc(orders.createdAt as any))
    .limit(limit)
    .offset(offset)

  // 5. Manually fetch product details for these orders
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
      time: toIsoTimestamp(order.paidAt || order.createdAt),
      type: displayType,
      target: product?.name || (locale === 'zh' ? '未知商品' : 'Unknown Product'),
      amount: Number(order.amount),
      currency: order.currency,
      status: order.payStatus,
      payMethod: order.payMethod || null
    }
  })

  // Count total for pagination
  const allUserOrders = await db.select({ id: orders.id as any }).from(orders as any).where(and(
    eq(orders.userId as any, userId),
    payStatusFilter
  ))
  const total = allUserOrders.length

  return {
    wallet,
    records: {
      list: formattedRecords,
      total: total
    }
  }
})
