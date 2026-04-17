import { and, desc, gte, lt } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { visitorEvents, visitorProfiles } from '../../db/schema'
import { parseStatsRange } from '../../utils/adminStats'

const toDate = (value: any) => {
  if (value instanceof Date) return value
  return new Date(value)
}

const toDateKey = (value: any) => {
  const date = toDate(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const formatSourceLabel = (item: any, mode: 'first' | 'last') => {
  const sourceType = item[mode === 'first' ? 'firstSourceType' : 'lastSourceType'] || 'direct'
  const source = item[mode === 'first' ? 'firstSource' : 'lastSource'] || 'direct'
  const medium = item[mode === 'first' ? 'firstMedium' : 'lastMedium'] || ''
  const campaign = item[mode === 'first' ? 'firstCampaign' : 'lastCampaign'] || ''

  if (campaign) return campaign
  if (sourceType === 'direct') return 'Direct'
  if (medium) return `${source} / ${medium}`
  return source
}

const buildTopList = (items: Record<string, number>, total: number) => {
  return Object.entries(items)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({
      label,
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
    }))
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { preset, days, rangeStart, rangeEnd } = parseStatsRange(query)

  const events = await db.select({
    id: visitorEvents.id,
    visitorId: visitorEvents.visitorId,
    userId: visitorEvents.userId,
    orderId: visitorEvents.orderId,
    productId: visitorEvents.productId,
    eventName: visitorEvents.eventName,
    eventAction: visitorEvents.eventAction,
    path: visitorEvents.path,
    referrer: visitorEvents.referrer,
    sourceType: visitorEvents.sourceType,
    source: visitorEvents.source,
    medium: visitorEvents.medium,
    campaign: visitorEvents.campaign,
    country: visitorEvents.country,
    region: visitorEvents.region,
    city: visitorEvents.city,
    locale: visitorEvents.locale,
    currency: visitorEvents.currency,
    deviceType: visitorEvents.deviceType,
    browser: visitorEvents.browser,
    os: visitorEvents.os,
    createdAt: visitorEvents.createdAt,
  })
    .from(visitorEvents)
    .where(and(gte(visitorEvents.createdAt, rangeStart), lt(visitorEvents.createdAt, rangeEnd)))
    .orderBy(desc(visitorEvents.createdAt))

  const profiles = await db.select()
    .from(visitorProfiles)
    .where(and(gte(visitorProfiles.lastSeenAt, rangeStart), lt(visitorProfiles.lastSeenAt, rangeEnd)))
    .orderBy(desc(visitorProfiles.lastSeenAt))

  const todayKey = toDateKey(new Date())
  const dateKeys = Array.from({ length: days }).map((_, index) => {
    const date = new Date(rangeStart)
    date.setDate(rangeStart.getDate() + index)
    return toDateKey(date)
  })

  const trendMap = new Map<string, {
    label: string
    pageViews: number
    uniqueVisitors: Set<string>
    productVisitors: Set<string>
    checkoutVisitors: Set<string>
    paidVisitors: Set<string>
    authVisitors: Set<string>
  }>()

  for (const dateKey of dateKeys) {
    trendMap.set(dateKey, {
      label: formatLabel(dateKey),
      pageViews: 0,
      uniqueVisitors: new Set<string>(),
      productVisitors: new Set<string>(),
      checkoutVisitors: new Set<string>(),
      paidVisitors: new Set<string>(),
      authVisitors: new Set<string>(),
    })
  }

  const pageViewVisitors = new Set<string>()
  const productVisitors = new Set<string>()
  const checkoutVisitors = new Set<string>()
  const paidVisitors = new Set<string>()
  const authVisitors = new Set<string>()
  const loginVisitors = new Set<string>()
  const registerVisitors = new Set<string>()
  const todayVisitors = new Set<string>()
  const firstTouchSourceMap: Record<string, number> = {}
  const lastTouchSourceMap: Record<string, number> = {}
  const sourceCategoryMap: Record<string, number> = {}
  const externalSourceMap: Record<string, number> = {}
  const countryMap: Record<string, number> = {}
  const deviceMap: Record<string, number> = {}
  const visitorEventStats = new Map<string, {
    pageViews: number
    productViews: number
    checkouts: number
    paid: number
    auth: number
  }>()

  for (const profile of profiles as any[]) {
    const firstTouch = formatSourceLabel(profile, 'first')
    const lastTouch = formatSourceLabel(profile, 'last')
    const sourceCategory = profile.lastSourceType || 'direct'
    firstTouchSourceMap[firstTouch] = (firstTouchSourceMap[firstTouch] || 0) + 1
    lastTouchSourceMap[lastTouch] = (lastTouchSourceMap[lastTouch] || 0) + 1
    sourceCategoryMap[sourceCategory] = (sourceCategoryMap[sourceCategory] || 0) + 1
    if (['search', 'social', 'referral'].includes(sourceCategory)) {
      externalSourceMap[lastTouch] = (externalSourceMap[lastTouch] || 0) + 1
    }
    countryMap[profile.country || 'Unknown'] = (countryMap[profile.country || 'Unknown'] || 0) + 1
    deviceMap[profile.deviceType || 'Unknown'] = (deviceMap[profile.deviceType || 'Unknown'] || 0) + 1
  }

  for (const item of events as any[]) {
    const dateKey = toDateKey(item.createdAt)
    const trendItem = trendMap.get(dateKey)
    const stats = visitorEventStats.get(item.visitorId) || {
      pageViews: 0,
      productViews: 0,
      checkouts: 0,
      paid: 0,
      auth: 0,
    }

    if (item.eventName === 'page_view') {
      pageViewVisitors.add(item.visitorId)
      stats.pageViews += 1
      if (trendItem) {
        trendItem.pageViews += 1
        trendItem.uniqueVisitors.add(item.visitorId)
      }
    }

    if (item.eventName === 'product_view') {
      productVisitors.add(item.visitorId)
      stats.productViews += 1
      if (trendItem) {
        trendItem.productVisitors.add(item.visitorId)
      }
    }

    if (item.eventName === 'begin_checkout') {
      checkoutVisitors.add(item.visitorId)
      stats.checkouts += 1
      if (trendItem) {
        trendItem.checkoutVisitors.add(item.visitorId)
      }
    }

    if (item.eventName === 'order_paid') {
      paidVisitors.add(item.visitorId)
      stats.paid += 1
      if (trendItem) {
        trendItem.paidVisitors.add(item.visitorId)
      }
    }

    if (item.eventName === 'auth') {
      authVisitors.add(item.visitorId)
      stats.auth += 1
      if (item.eventAction === 'login') loginVisitors.add(item.visitorId)
      if (item.eventAction === 'register') registerVisitors.add(item.visitorId)
      if (trendItem) {
        trendItem.authVisitors.add(item.visitorId)
      }
    }

    if (dateKey === todayKey) {
      todayVisitors.add(item.visitorId)
    }

    visitorEventStats.set(item.visitorId, stats)
  }

  const trend = dateKeys.map(dateKey => {
    const item = trendMap.get(dateKey)!
    return {
      date: dateKey,
      label: item.label,
      pageViews: item.pageViews,
      uniqueVisitors: item.uniqueVisitors.size,
      productVisitors: item.productVisitors.size,
      checkoutVisitors: item.checkoutVisitors.size,
      paidVisitors: item.paidVisitors.size,
      authVisitors: item.authVisitors.size,
    }
  })

  return {
    range: {
      preset: preset || `${days}d`,
      days,
      from: rangeStart,
      to: rangeEnd,
    },
    overview: {
      pageViews: events.filter((item: any) => item.eventName === 'page_view').length,
      uniqueVisitors: pageViewVisitors.size,
      todayVisitors: todayVisitors.size,
      productVisitors: productVisitors.size,
      checkoutVisitors: checkoutVisitors.size,
      paidVisitors: paidVisitors.size,
      authVisitors: authVisitors.size,
      loginVisitors: loginVisitors.size,
      registerVisitors: registerVisitors.size,
      conversionRate: pageViewVisitors.size > 0 ? Number(((paidVisitors.size / pageViewVisitors.size) * 100).toFixed(1)) : 0,
    },
    funnel: [
      { key: 'page_view', label: 'Page Views', visitors: pageViewVisitors.size },
      { key: 'product_view', label: 'Product Views', visitors: productVisitors.size },
      { key: 'begin_checkout', label: 'Begin Checkout', visitors: checkoutVisitors.size },
      { key: 'order_paid', label: 'Order Paid', visitors: paidVisitors.size },
      { key: 'auth', label: 'Register / Login', visitors: authVisitors.size },
    ],
    trend,
    sources: {
      categories: buildTopList(sourceCategoryMap, profiles.length),
      external: buildTopList(externalSourceMap, profiles.length),
      firstTouch: buildTopList(firstTouchSourceMap, profiles.length),
      lastTouch: buildTopList(lastTouchSourceMap, profiles.length),
    },
    geography: buildTopList(countryMap, profiles.length),
    devices: buildTopList(deviceMap, profiles.length),
  }
})
