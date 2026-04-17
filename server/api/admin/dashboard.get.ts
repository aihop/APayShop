import { orders } from "../../db/schema"
import { sql } from "drizzle-orm"
import { db } from '@nuxthub/db'
import { ORDER_PAY_STATUS } from '../../utils/constants'

export default defineEventHandler(async (event) => {
  const explicitDialect = process.env.DB_DIALECT?.replace(/"/g, '').toLowerCase()
  const connectionUrl =
    process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRESQL_URL
    || process.env.NUXT_DATABASE_URL
    || ''
  const isPostgres =
    explicitDialect === 'postgresql'
    || connectionUrl.startsWith('postgres://')
    || connectionUrl.startsWith('postgresql://')

  // Get start of today
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const startOfDayMs = startOfDay.getTime()
  const startOfDayDate = new Date(startOfDayMs)
  const startOfDayIso = startOfDayDate.toISOString()

  // 1. Get Summary Stats
  // 注意：在之前的版本中，有的 createdAt 是按秒存的（10位），有的是按毫秒存的（13位）
  // 1774777008 vs 1774776860215。为了兼容，我们使用比较宽松的逻辑，把 startOfDay 也转为秒来进行判断，
  // SQLite 里可以直接判断：当 created_at 大于等于毫秒或者秒级时间戳。
  const startOfDaySec = Math.floor(startOfDayMs / 1000)

  const statsResult = isPostgres
    ? await db.select({
        totalOrders: sql<number>`count(*)`,
        totalRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
        todayOrders: sql<number>`coalesce(sum(case when ${orders.createdAt} >= ${startOfDayIso}::timestamptz then 1 else 0 end), 0)`,
        todayRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} and ${orders.createdAt} >= ${startOfDayIso}::timestamptz then ${orders.amount} else 0 end), 0)`,
      }).from(orders)
    : await db.select({
        totalOrders: sql<number>`count(*)`,
        totalRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
        todayOrders: sql<number>`coalesce(sum(case when ${orders.createdAt} >= ${startOfDayMs} OR (${orders.createdAt} < 1000000000000 AND ${orders.createdAt} >= ${startOfDaySec}) then 1 else 0 end), 0)`,
        todayRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} and (${orders.createdAt} >= ${startOfDayMs} OR (${orders.createdAt} < 1000000000000 AND ${orders.createdAt} >= ${startOfDaySec})) then ${orders.amount} else 0 end), 0)`,
      }).from(orders)

  const stats = statsResult[0] || { totalOrders: 0, totalRevenue: 0, todayOrders: 0, todayRevenue: 0 }

  // 2. Get Hourly Data for Today (only paid orders for revenue)
  // 为了兼容秒级和毫秒级时间戳，我们可以在 SQL 里判断：如果是毫秒级（>1000000000000），就除以 1000。
  const hourlyData = isPostgres
    ? await db.select({
        hour: sql<string>`to_char(date_trunc('hour', ${orders.createdAt}), 'HH24')`,
        ordersCount: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
      })
        .from(orders)
        .where(sql`${orders.createdAt} >= ${startOfDayIso}::timestamptz`)
        .groupBy(sql`date_trunc('hour', ${orders.createdAt})`)
    : await db.select({
        hour: sql<string>`strftime('%H', datetime(CASE WHEN ${orders.createdAt} > 1000000000000 THEN ${orders.createdAt} / 1000 ELSE ${orders.createdAt} END, 'unixepoch', 'localtime'))`,
        ordersCount: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
      })
        .from(orders)
        .where(sql`${orders.createdAt} >= ${startOfDayMs} OR (${orders.createdAt} < 1000000000000 AND ${orders.createdAt} >= ${startOfDaySec})`)
        .groupBy(sql`strftime('%H', datetime(CASE WHEN ${orders.createdAt} > 1000000000000 THEN ${orders.createdAt} / 1000 ELSE ${orders.createdAt} END, 'unixepoch', 'localtime'))`)

  // Format hourly data into a map for easy lookup
  const hourlyMap = new Map()
  hourlyData.forEach((item: any) => {
    hourlyMap.set(item.hour, {
      orders: item.ordersCount || 0,
      revenue: item.revenue || 0
    })
  })

  // Generate 24 hours data array
  const currentHour = new Date().getHours()
  const labels = []
  const hourlyOrders = []
  const hourlyRevenue = []

  for (let i = 0; i <= 23; i++) {
    const hourStr = i.toString().padStart(2, '0')
    labels.push(`${hourStr}:00`)
    
    if (i <= currentHour) {
      const data = hourlyMap.get(hourStr) || { orders: 0, revenue: 0 }
      hourlyOrders.push(data.orders)
      hourlyRevenue.push(data.revenue)
    } else {
      hourlyOrders.push(0)
      hourlyRevenue.push(0)
    }
  }

  return {
    stats: {
      todayOrders: Number(stats.todayOrders || 0),
      todayRevenue: Number(stats.todayRevenue || 0),
      totalOrders: Number(stats.totalOrders || 0),
      totalRevenue: Number(stats.totalRevenue || 0),
    },
    chart: {
      labels,
      orders: hourlyOrders,
      revenue: hourlyRevenue
    }
  }
})
