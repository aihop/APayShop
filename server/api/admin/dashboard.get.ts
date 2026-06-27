import { orders } from "../../db/schema"
import { sql } from "drizzle-orm"
import { db } from '../../db/runtime'
import { ORDER_PAY_STATUS } from '../../utils/constants'
import { getConfiguredTimezone, getStartOfDayUtc, getCurrentHour, getSqliteOffsetModifier, getMysqlOffsetStr } from '../../utils/timezone'

export default defineEventHandler(async (event) => {
  const explicitDialect = process.env.DB_DIALECT?.replace(/"/g, '').toLowerCase()
  const connectionUrl =
    process.env.DATABASE_URL
    || process.env.MYSQL_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRESQL_URL
    || process.env.NUXT_DATABASE_URL
    || ''
  const isPostgres =
    explicitDialect === 'postgresql'
    || connectionUrl.startsWith('postgres://')
    || connectionUrl.startsWith('postgresql://')
  const isMysql =
    explicitDialect === 'mysql'
    || connectionUrl.startsWith('mysql://')

  // 按管理员配置的时区计算"今天"的 UTC 边界
  const tz = await getConfiguredTimezone()
  const startOfDay = getStartOfDayUtc(tz)
  const startOfDayMs = startOfDay.ms
  const startOfDaySec = startOfDay.sec
  const startOfDayIso = startOfDay.iso
  const startOfDayMysql = startOfDay.mysql

  // 1. Get Summary Stats
  const statsResult = isPostgres
    ? await db.select({
        totalOrders: sql<number>`count(*)`,
        totalRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
        todayOrders: sql<number>`coalesce(sum(case when ${orders.createdAt} >= ${startOfDayIso}::timestamptz then 1 else 0 end), 0)`,
        todayRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} and ${orders.createdAt} >= ${startOfDayIso}::timestamptz then ${orders.amount} else 0 end), 0)`,
      }).from(orders)
    : isMysql
    ? await db.select({
        totalOrders: sql<number>`count(*)`,
        totalRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
        todayOrders: sql<number>`coalesce(sum(case when ${orders.createdAt} >= ${startOfDayMysql} then 1 else 0 end), 0)`,
        todayRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} and ${orders.createdAt} >= ${startOfDayMysql} then ${orders.amount} else 0 end), 0)`,
      }).from(orders)
    : await db.select({
        totalOrders: sql<number>`count(*)`,
        totalRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
        todayOrders: sql<number>`coalesce(sum(case when ${orders.createdAt} >= ${startOfDayMs} OR (${orders.createdAt} < 1000000000000 AND ${orders.createdAt} >= ${startOfDaySec}) then 1 else 0 end), 0)`,
        todayRevenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} and (${orders.createdAt} >= ${startOfDayMs} OR (${orders.createdAt} < 1000000000000 AND ${orders.createdAt} >= ${startOfDaySec})) then ${orders.amount} else 0 end), 0)`,
      }).from(orders)

  const stats = statsResult[0] || { totalOrders: 0, totalRevenue: 0, todayOrders: 0, todayRevenue: 0 }

  // 2. Get Hourly Data for Today (only paid orders for revenue)
  const sqliteOffset = getSqliteOffsetModifier(tz)
  const mysqlOffset = getMysqlOffsetStr(tz)

  const hourlyData = isPostgres
    ? await db.select({
        hour: sql<string>`to_char(date_trunc('hour', ${orders.createdAt} AT TIME ZONE ${tz}), 'HH24')`,
        ordersCount: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
      })
        .from(orders)
        .where(sql`${orders.createdAt} >= ${startOfDayIso}::timestamptz`)
        .groupBy(sql`date_trunc('hour', ${orders.createdAt} AT TIME ZONE ${tz})`)
    : isMysql
    ? await db.select({
        hour: sql<string>`DATE_FORMAT(CONVERT_TZ(${orders.createdAt}, '+00:00', ${mysqlOffset}), '%H')`,
        ordersCount: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
      })
        .from(orders)
        .where(sql`${orders.createdAt} >= ${startOfDayMysql}`)
        .groupBy(sql`DATE_FORMAT(CONVERT_TZ(${orders.createdAt}, '+00:00', ${mysqlOffset}), '%H')`)
    : await db.select({
        hour: sql<string>`strftime('%H', datetime(CASE WHEN ${orders.createdAt} > 1000000000000 THEN ${orders.createdAt} / 1000 ELSE ${orders.createdAt} END, 'unixepoch', ${sqliteOffset}))`,
        ordersCount: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(case when ${orders.payStatus} = ${ORDER_PAY_STATUS.PAID} then ${orders.amount} else 0 end), 0)`,
      })
        .from(orders)
        .where(sql`${orders.createdAt} >= ${startOfDayMs} OR (${orders.createdAt} < 1000000000000 AND ${orders.createdAt} >= ${startOfDaySec})`)
        .groupBy(sql`strftime('%H', datetime(CASE WHEN ${orders.createdAt} > 1000000000000 THEN ${orders.createdAt} / 1000 ELSE ${orders.createdAt} END, 'unixepoch', ${sqliteOffset}))`)

  // Format hourly data into a map for easy lookup
  const hourlyMap = new Map()
  hourlyData.forEach((item: any) => {
    hourlyMap.set(item.hour, {
      orders: item.ordersCount || 0,
      revenue: item.revenue || 0
    })
  })

  // Generate 24 hours data array
  const currentHour = getCurrentHour(tz)
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
