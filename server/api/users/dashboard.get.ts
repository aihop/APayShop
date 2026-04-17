import { users, orders, products } from "../../db/schema"
import { eq, desc } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const session: any = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }
  
  const userId = session.user.id

  // 1. 获取用户信息 (包含余额等)
  const userRecords = await db.select().from(users as any).where(eq(users.id as any, userId))
  const user: any = userRecords[0]

  // 2. 获取订单统计
  const allOrders = await db.select({
    id: orders.id as any,
    status: orders.status as any,
    payStatus: orders.payStatus as any,
    amount: orders.amount as any,
    createdAt: orders.createdAt as any,
    productName: products.name as any
  })
  .from(orders as any)
  .leftJoin(products as any, eq(orders.productId as any, products.id as any))
  .where(eq(orders.userId as any, userId))
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
      cashBalance: (Number(user.CashBalance || 0) + Number(user.GrantBalance || 0)) / 100000000,
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
