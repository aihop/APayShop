import { orders } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'
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

interface DashboardOrderRow extends OrderCurrencyInput {
  payStatus: string
  createdAt: unknown
}

export default defineEventHandler(async () => {
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
  const startOfDay = getStartOfDayUtc(timezone)
  const todayCondition = isPostgres
    ? sql`${orders.createdAt} >= ${startOfDay.iso}::timestamptz`
    : isMysql
      ? sql`${orders.createdAt} >= ${startOfDay.mysql}`
      : sql`${orders.createdAt} >= ${startOfDay.ms} OR (${orders.createdAt} < 1000000000000 AND ${orders.createdAt} >= ${startOfDay.sec})`

  const selectFields = {
    amount: orders.amount,
    currency: orders.currency,
    metaData: orders.metaData,
    payStatus: orders.payStatus,
    createdAt: orders.createdAt,
  }
  const [rawPaidOrderRows, rawTodayOrderRows, totalOrderRows, baseQuote] = await Promise.all([
    db.select(selectFields).from(orders).where(eq(orders.payStatus, ORDER_PAY_STATUS.PAID)),
    db.select(selectFields).from(orders).where(todayCondition),
    db.select({ count: sql<number>`count(*)` }).from(orders),
    buildLocaleCurrencyQuote(0),
  ])
  const paidOrders = rawPaidOrderRows as DashboardOrderRow[]
  const todayOrderRows = rawTodayOrderRows as DashboardOrderRow[]

  const paidTodayOrders = todayOrderRows.filter(order => order.payStatus === ORDER_PAY_STATUS.PAID)
  const totalRevenueByCurrency = aggregateOrderAccountingTotals(paidOrders)
  const todayRevenueByCurrency = aggregateOrderAccountingTotals(paidTodayOrders)
  const baseCurrency = baseQuote.baseCurrency
  const hourlyRevenue = new Array<number>(24).fill(0)
  const hourlyOrders = new Array<number>(24).fill(0)

  for (const order of todayOrderRows) {
    const hour = Number(getHourInTimezone(order.createdAt, timezone))
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue
    hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1
    if (order.payStatus !== ORDER_PAY_STATUS.PAID) continue
    const amounts = resolveOrderCurrencyAmounts(order)
    if (amounts.accountingCurrency === baseCurrency) {
      hourlyRevenue[hour] = (hourlyRevenue[hour] || 0) + amounts.accountingAmount
    }
  }

  const currentHour = getCurrentHour(timezone)
  const labels = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, '0')}:00`)
  for (let hour = currentHour + 1; hour < 24; hour++) {
    hourlyOrders[hour] = 0
    hourlyRevenue[hour] = 0
  }

  return {
    stats: {
      todayOrders: todayOrderRows.length,
      todayRevenue: getCurrencyTotal(todayRevenueByCurrency, baseCurrency),
      todayRevenueByCurrency,
      totalOrders: Number(totalOrderRows[0]?.count || 0),
      totalRevenue: getCurrencyTotal(totalRevenueByCurrency, baseCurrency),
      totalRevenueByCurrency,
      currency: baseCurrency,
    },
    chart: {
      labels,
      orders: hourlyOrders,
      revenue: hourlyRevenue,
      currency: baseCurrency,
    },
  }
})
