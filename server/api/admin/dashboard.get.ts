import { cards, orders, products, subscriptions, topups, users } from '../../db/schema'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/runtime'
import { ORDER_PAY_STATUS } from '../../utils/constants'
import { buildLocaleCurrencyQuote } from '../../utils/localeCurrency'
import { aggregateOrderAccountingTotals, getCurrencyTotal, resolveOrderCurrencyAmounts } from '../../utils/orderCurrency'
import type { OrderCurrencyInput } from '../../utils/orderCurrency'
import { getConfiguredTimezone, getStartOfDayUtc, getCurrentHour } from '../../utils/timezone'

const getHourInTimezone = (value: unknown, timezone: string): string => {
  const date = value instanceof Date ? value : new Date(value as any)
  if (Number.isNaN(date.getTime())) return '00'
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date).find(item => item.type === 'hour')?.value
  return part === '24' ? '00' : (part || '00')
}

const getDateKeyInTimezone = (value: unknown, timezone: string): string => {
  const date = value instanceof Date ? value : new Date(value as any)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

interface DashboardOrderRow extends OrderCurrencyInput {
  id: string
  payStatus: string
  status?: string | null
  contactEmail?: string | null
  payMethod?: string | null
  createdAt: unknown
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const range = String(query.range || 'today') // 'today' | '7d' | '30d'

  const explicitDialect = process.env.DB_DIALECT?.replace(/"/g, '').toLowerCase()
  const connectionUrl = process.env.DATABASE_URL
    || process.env.MYSQL_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRESQL_URL
    || process.env.NUXT_DATABASE_URL
    || ''
  const isPostgres = explicitDialect === 'postgresql'
    || connectionUrl.startsWith('postgres://')
    || connectionUrl.startsWith('postgresql://')
  const isMysql = explicitDialect === 'mysql' || connectionUrl.startsWith('mysql://')

  const timezone = await getConfiguredTimezone()
  const now = new Date()
  const startOfDay = getStartOfDayUtc(timezone)

  const todayCondition = isPostgres
    ? sql`${orders.createdAt} >= ${startOfDay.iso}::timestamptz`
    : isMysql
      ? sql`${orders.createdAt} >= ${startOfDay.mysql}`
      : sql`${orders.createdAt} >= ${startOfDay.ms} OR (${orders.createdAt} < 1000000000000 AND ${orders.createdAt} >= ${startOfDay.sec})`

  const selectFields = {
    id: orders.id,
    amount: orders.amount,
    currency: orders.currency,
    metaData: orders.metaData,
    payStatus: orders.payStatus,
    status: orders.status,
    contactEmail: orders.contactEmail,
    payMethod: orders.payMethod,
    createdAt: orders.createdAt,
  }

  const [
    rawPaidOrderRows,
    rawTodayOrderRows,
    totalOrderRows,
    baseQuote,
    totalUsersCount,
    totalProductsCount,
    activeSubscriptionsCount,
    pendingFulfillmentsCount,
    pendingTopupsCount,
    recentOrdersResult,
    keyProducts,
  ] = await Promise.all([
    db.select(selectFields).from(orders).where(eq(orders.payStatus, ORDER_PAY_STATUS.PAID)),
    db.select(selectFields).from(orders).where(todayCondition),
    db.select({ count: sql<number>`count(*)` }).from(orders),
    buildLocaleCurrencyQuote(0),
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.isActive, true)),
    db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, 'active')),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(eq(orders.payStatus, ORDER_PAY_STATUS.PAID), eq(orders.status, 'pending'))),
    db.select({ count: sql<number>`count(*)` }).from(topups).where(inArray(topups.status, ['paid', 'crediting', 'credit_failed', 'review_required'])),
    db.select(selectFields).from(orders).orderBy(desc(orders.createdAt)).limit(6),
    db.select({ id: products.id, name: products.name }).from(products).where(and(eq(products.type, 'key'), eq(products.isActive, true))),
  ])

  const paidOrders = rawPaidOrderRows as DashboardOrderRow[]
  const todayOrderRows = rawTodayOrderRows as DashboardOrderRow[]
  const paidTodayOrders = todayOrderRows.filter(order => order.payStatus === ORDER_PAY_STATUS.PAID)

  const totalRevenueByCurrency = aggregateOrderAccountingTotals(paidOrders)
  const todayRevenueByCurrency = aggregateOrderAccountingTotals(paidTodayOrders)
  const baseCurrency = baseQuote.baseCurrency

  // 卡密低库存检查 (可用卡密数 <= 3)
  let lowStockCardsCount = 0
  if (keyProducts.length > 0) {
    for (const kp of keyProducts) {
      const avail = await db.select({ count: sql<number>`count(*)` }).from(cards).where(and(eq(cards.productId, kp.id), eq(cards.isUsed, false)))
      const stock = Number(avail[0]?.count || 0)
      if (stock <= 3) {
        lowStockCardsCount++
      }
    }
  }

  // 趋势图数据计算
  let labels: string[] = []
  let ordersSeries: number[] = []
  let revenueSeries: number[] = []

  if (range === '7d' || range === '30d') {
    const dayCount = range === '7d' ? 7 : 30
    const dayKeys: string[] = []
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dayKeys.push(getDateKeyInTimezone(d, timezone))
    }
    labels = dayKeys
    ordersSeries = new Array<number>(dayCount).fill(0)
    revenueSeries = new Array<number>(dayCount).fill(0)

    for (const order of paidOrders) {
      const dKey = getDateKeyInTimezone(order.createdAt, timezone)
      const idx = dayKeys.indexOf(dKey)
      if (idx !== -1) {
        ordersSeries[idx]++
        const amounts = resolveOrderCurrencyAmounts(order)
        if (amounts.accountingCurrency === baseCurrency) {
          revenueSeries[idx] = Number(((revenueSeries[idx] || 0) + amounts.accountingAmount).toFixed(2))
        }
      }
    }
  } else {
    // 今日 24 小时
    labels = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, '0')}:00`)
    ordersSeries = new Array<number>(24).fill(0)
    revenueSeries = new Array<number>(24).fill(0)

    for (const order of todayOrderRows) {
      const hour = Number(getHourInTimezone(order.createdAt, timezone))
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue
      ordersSeries[hour] = (ordersSeries[hour] || 0) + 1
      if (order.payStatus !== ORDER_PAY_STATUS.PAID) continue
      const amounts = resolveOrderCurrencyAmounts(order)
      if (amounts.accountingCurrency === baseCurrency) {
        revenueSeries[hour] = Number(((revenueSeries[hour] || 0) + amounts.accountingAmount).toFixed(2))
      }
    }

    const currentHour = getCurrentHour(timezone)
    for (let hour = currentHour + 1; hour < 24; hour++) {
      ordersSeries[hour] = 0
      revenueSeries[hour] = 0
    }
  }

  // 销售与品类构成分布
  const mixMap: Record<string, { count: number; amount: number }> = {
    standard: { count: 0, amount: 0 },
    key: { count: 0, amount: 0 },
    subscription: { count: 0, amount: 0 },
    topup: { count: 0, amount: 0 },
  }

  for (const order of paidOrders) {
    let type = 'standard'
    try {
      const meta = typeof order.metaData === 'string' ? JSON.parse(order.metaData) : order.metaData
      if (meta?.product_type) {
        type = meta.product_type
      } else if (meta?.is_subscription || meta?.subscription_id) {
        type = 'subscription'
      } else if (meta?.is_topup || order.id?.startsWith('topup_')) {
        type = 'topup'
      }
    } catch {}

    if (!mixMap[type]) {
      mixMap[type] = { count: 0, amount: 0 }
    }
    mixMap[type].count++
    const amounts = resolveOrderCurrencyAmounts(order)
    if (amounts.accountingCurrency === baseCurrency) {
      mixMap[type].amount = Number((mixMap[type].amount + amounts.accountingAmount).toFixed(2))
    }
  }

  const categoryMix = Object.entries(mixMap).map(([type, val]) => ({
    type,
    count: val.count,
    amount: val.amount,
  }))

  return {
    stats: {
      todayOrders: todayOrderRows.length,
      todayRevenue: getCurrencyTotal(todayRevenueByCurrency, baseCurrency),
      todayRevenueByCurrency,
      totalOrders: Number(totalOrderRows[0]?.count || 0),
      totalRevenue: getCurrencyTotal(totalRevenueByCurrency, baseCurrency),
      totalRevenueByCurrency,
      totalUsers: Number(totalUsersCount[0]?.count || 0),
      activeProducts: Number(totalProductsCount[0]?.count || 0),
      activeSubscriptions: Number(activeSubscriptionsCount[0]?.count || 0),
      currency: baseCurrency,
    },
    actionItems: {
      pendingFulfillments: Number(pendingFulfillmentsCount[0]?.count || 0),
      lowStockCards: lowStockCardsCount,
      pendingTopups: Number(pendingTopupsCount[0]?.count || 0),
    },
    categoryMix,
    recentOrders: recentOrdersResult,
    chart: {
      labels,
      orders: ordersSeries,
      revenue: revenueSeries,
      currency: baseCurrency,
      range,
    },
    timezone,
    generatedAt: now.toISOString(),
  }
})
