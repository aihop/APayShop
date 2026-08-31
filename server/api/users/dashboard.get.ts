import { users, userWallets, orders, products } from "../../db/schema"
import { eq, desc, and, ne } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from "../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }
  
  const userId = session.user.id

  // 1. 获取用户与钱包信息
  const userRecords = await db.select({
    createdAt: users.createdAt,
    cashBalance: userWallets.cashBalance,
    grantBalance: userWallets.grantBalance,
  }).from(users)
    .leftJoin(userWallets, eq(userWallets.userId, users.id))
    .where(eq(users.id, userId))
  const user: any = userRecords[0] || {}

  // 2. 获取订单统计（排除已软删除的订单）
  const allOrders = await db.select({
    id: orders.id as any,
    status: orders.status as any,
    payStatus: orders.payStatus as any,
    amount: orders.amount as any,
    currency: orders.currency as any,
    createdAt: orders.createdAt as any,
    productName: products.name as any
  })
  .from(orders as any)
  .leftJoin(products as any, eq(orders.productId as any, products.id as any))
  .where(and(
    eq(orders.userId as any, userId),
    ne(orders.payStatus as any, 'deleted')
  ))
  .orderBy(desc(orders.createdAt as any))

  const totalOrders = allOrders.length
  const paidOrders = allOrders.filter((o: any) => o.payStatus === 'paid').length
  const pendingOrders = allOrders.filter((o: any) => o.payStatus === 'pending').length
  const recentOrders = allOrders.slice(0, 5)

  // 3. 获取活跃的订阅/服务 (状态为 active 的订单)
  const activeServices = allOrders.filter((o: any) => o.status === 'active').slice(0, 3)

  return {
    code: 0,
    data: {
      createdAt: user.createdAt || null,
      cashBalance: (Number(user.cashBalance || 0) + Number(user.grantBalance || 0)) / 100000000,
      stats: {
        totalOrders,
        paidOrders,
        pendingOrders
      },
      recentOrders,
      activeServices
    }
  }
})
