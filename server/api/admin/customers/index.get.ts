import { orders } from '../../../db/schema'
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { toIsoTimestamp } from '../../../utils/dbTime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { aggregateOrderAccountingTotals } from '../../../utils/orderCurrency'

interface CustomerGroupRow {
  email: string | null
  visitorId: string | null
  totalOrders: number
  firstOrderAt: unknown
  lastOrderAt: unknown
  unpaidOrders: number
}

interface CustomerPaidOrderRow {
  email: string | null
  visitorId: string | null
  amount: number
  currency: string
  metaData: unknown
}

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  try {
    const query = getQuery(event)
    const page = Math.max(parseInt(query.page as string) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(query.pageSize as string) || 15, 1), 100)
    const offset = (page - 1) * pageSize
    const search = String(query.search || query.q || query.keyword || '').trim().toLowerCase()
    const searchPattern = search ? `%${search}%` : ''

    let namedWhere = sql`${orders.contactEmail} IS NOT NULL AND ${orders.contactEmail} != '' AND ${orders.payStatus} != 'deleted' AND ${orders.status} != 'deleted'`
    if (search) {
      namedWhere = sql`${orders.contactEmail} IS NOT NULL AND ${orders.contactEmail} != '' AND ${orders.payStatus} != 'deleted' AND ${orders.status} != 'deleted' AND (lower(${orders.contactEmail}) LIKE ${searchPattern} OR lower(coalesce(${orders.visitorId}, '')) LIKE ${searchPattern})`
    }

    const namedGroups = await db.select({
      email: orders.contactEmail,
      visitorId: sql<string | null>`MAX(${orders.visitorId})`,
      totalOrders: sql<number>`COUNT(${orders.id})`,
      firstOrderAt: sql<unknown>`MIN(${orders.createdAt})`,
      lastOrderAt: sql<unknown>`MAX(${orders.createdAt})`,
      unpaidOrders: sql<number>`SUM(CASE WHEN ${orders.payStatus} != 'paid' THEN 1 ELSE 0 END)`,
    }).from(orders)
      .where(namedWhere)
      .groupBy(orders.contactEmail) as CustomerGroupRow[]

    let anonymousWhere = sql`(${orders.contactEmail} IS NULL OR ${orders.contactEmail} = '') AND ${orders.visitorId} IS NOT NULL AND ${orders.payStatus} != 'deleted' AND ${orders.status} != 'deleted'`
    if (search) {
      anonymousWhere = sql`(${orders.contactEmail} IS NULL OR ${orders.contactEmail} = '') AND ${orders.visitorId} IS NOT NULL AND ${orders.payStatus} != 'deleted' AND ${orders.status} != 'deleted' AND lower(${orders.visitorId}) LIKE ${searchPattern}`
    }

    const anonymousGroups = await db.select({
      email: sql<string | null>`NULL`,
      visitorId: orders.visitorId,
      totalOrders: sql<number>`COUNT(${orders.id})`,
      firstOrderAt: sql<unknown>`MIN(${orders.createdAt})`,
      lastOrderAt: sql<unknown>`MAX(${orders.createdAt})`,
      unpaidOrders: sql<number>`SUM(CASE WHEN ${orders.payStatus} != 'paid' THEN 1 ELSE 0 END)`,
    }).from(orders)
      .where(anonymousWhere)
      .groupBy(orders.visitorId) as CustomerGroupRow[]

    const groups = [...namedGroups, ...anonymousGroups]
      .map(group => ({
        ...group,
        isAnonymous: !group.email,
        email: group.email || (locale === 'zh' ? '匿名访客' : 'Anonymous'),
        totalOrders: Number(group.totalOrders || 0),
        firstOrderAt: toIsoTimestamp(group.firstOrderAt) || null,
        lastOrderAt: toIsoTimestamp(group.lastOrderAt) || null,
        unpaidOrders: Number(group.unpaidOrders || 0),
      }))
      .sort((left, right) => String(right.lastOrderAt || '').localeCompare(String(left.lastOrderAt || '')))
    const paginatedGroups = groups.slice(offset, offset + pageSize)
    const namedEmails = paginatedGroups
      .filter(group => !group.isAnonymous)
      .map(group => String(group.email || '').trim())
      .filter(Boolean)
    const anonymousVisitorIds = paginatedGroups
      .filter(group => group.isAnonymous)
      .map(group => String(group.visitorId || '').trim())
      .filter(Boolean)
    const identityConditions = []
    if (namedEmails.length) identityConditions.push(inArray(orders.contactEmail, namedEmails))
    if (anonymousVisitorIds.length) {
      identityConditions.push(and(
        or(isNull(orders.contactEmail), eq(orders.contactEmail, '')),
        inArray(orders.visitorId, anonymousVisitorIds),
      ))
    }
    const paidOrderRows: CustomerPaidOrderRow[] = identityConditions.length
      ? await db.select({
        email: orders.contactEmail,
        visitorId: orders.visitorId,
        amount: orders.amount,
        currency: orders.currency,
        metaData: orders.metaData,
      }).from(orders).where(and(
        eq(orders.payStatus, 'paid'),
        or(...identityConditions),
      ))
      : []
    const totalsByIdentity = new Map<string, ReturnType<typeof aggregateOrderAccountingTotals>>()
    for (const group of paginatedGroups) {
      const email = String(group.email || '').trim()
      const matchingOrders = paidOrderRows.filter(order => group.isAnonymous
        ? String(order.visitorId || '') === String(group.visitorId || '') && !String(order.email || '').trim()
        : String(order.email || '').trim() === email)
      const key = group.isAnonymous ? `visitor:${group.visitorId}` : `email:${email}`
      totalsByIdentity.set(key, aggregateOrderAccountingTotals(matchingOrders))
    }
    const data = paginatedGroups.map((group) => {
      const email = String(group.email || '').trim()
      const key = group.isAnonymous ? `visitor:${group.visitorId}` : `email:${email}`
      const totalSpentByCurrency = totalsByIdentity.get(key) || []
      return {
        email: group.email,
        visitorId: group.visitorId,
        totalOrders: group.totalOrders,
        firstOrderAt: group.firstOrderAt,
        lastOrderAt: group.lastOrderAt,
        unpaidOrders: group.unpaidOrders,
        totalSpent: totalSpentByCurrency.length === 1 ? (totalSpentByCurrency[0]?.amount || 0) : 0,
        totalSpentByCurrency,
      }
    })

    return {
      data,
      total: groups.length,
      page,
      pageSize,
    }
  } catch (error: any) {
    console.error('Fetch customers error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || (locale === 'zh' ? '获取客户列表失败' : 'Failed to fetch customers'),
    })
  }
})
