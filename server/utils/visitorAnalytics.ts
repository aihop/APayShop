import crypto from 'node:crypto'
import { getCookie, getHeader, getRequestURL, setCookie } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { visitorEvents, visitorProfiles } from '../db/schema'

type TrackVisitorEventInput = {
  visitorId?: string | null
  userId?: number | null
  orderId?: string | null
  productId?: number | null
  eventName: string
  eventAction?: string | null
  path?: string | null
  referrer?: string | null
  locale?: string | null
  currency?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  deviceType?: string | null
  browser?: string | null
  os?: string | null
  userAgent?: string | null
  createdAt?: Date
}

const SEARCH_HOSTS = ['google.', 'bing.com', 'baidu.com', 'duckduckgo.com', 'yahoo.', 'yandex.', 'ecosia.org']
const SOCIAL_HOSTS = ['facebook.com', 'instagram.com', 'x.com', 'twitter.com', 't.co', 'linkedin.com', 'reddit.com', 'youtube.com', 'tiktok.com']

const normalizeValue = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 500) : null
}

const buildUrl = (value?: string | null, host?: string | null) => {
  if (!value) return null
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return new URL(value)
    }
    if (value.startsWith('/') && host) {
      return new URL(value, `https://${host}`)
    }
  } catch {
  }
  return null
}

const normalizePath = (value?: string | null, host?: string | null) => {
  if (!value) return null
  if (value.startsWith('/')) return value.slice(0, 1000)
  const url = buildUrl(value, host)
  if (!url) return normalizeValue(value)?.slice(0, 1000) || null
  return `${url.pathname}${url.search}`.slice(0, 1000)
}

const readCountry = (event: any) => {
  const values = [
    getHeader(event, 'cf-ipcountry'),
    getHeader(event, 'x-vercel-ip-country'),
    getHeader(event, 'cloudfront-viewer-country'),
    getHeader(event, 'x-country-code'),
  ].map(value => normalizeValue(value)?.toUpperCase())

  return values.find(Boolean) || null
}

const readRegion = (event: any) =>
  normalizeValue(
    getHeader(event, 'x-vercel-ip-country-region')
    || getHeader(event, 'cloudfront-viewer-country-region')
    || getHeader(event, 'x-region')
  )

const readCity = (event: any) =>
  normalizeValue(
    getHeader(event, 'x-vercel-ip-city')
    || getHeader(event, 'x-city')
  )

const parseDeviceType = (userAgent: string) => {
  const ua = userAgent.toLowerCase()
  if (/bot|crawler|spider|headless/.test(ua)) return 'bot'
  if (/ipad|tablet/.test(ua)) return 'tablet'
  if (/mobi|iphone|android/.test(ua)) return 'mobile'
  return 'desktop'
}

const parseBrowser = (userAgent: string) => {
  const ua = userAgent.toLowerCase()
  if (ua.includes('edg/')) return 'Edge'
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera'
  if (ua.includes('chrome/')) return 'Chrome'
  if (ua.includes('firefox/')) return 'Firefox'
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari'
  return 'Other'
}

const parseOs = (userAgent: string) => {
  const ua = userAgent.toLowerCase()
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS'
  if (ua.includes('mac os')) return 'macOS'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('linux')) return 'Linux'
  return 'Other'
}

const classifySource = (path?: string | null, referrer?: string | null, host?: string | null) => {
  const currentUrl = buildUrl(path, host)
  const referrerUrl = buildUrl(referrer)

  const source = normalizeValue(currentUrl?.searchParams.get('utm_source'))
  const medium = normalizeValue(currentUrl?.searchParams.get('utm_medium'))
  const campaign = normalizeValue(currentUrl?.searchParams.get('utm_campaign'))
  const content = normalizeValue(currentUrl?.searchParams.get('utm_content'))
  const term = normalizeValue(currentUrl?.searchParams.get('utm_term'))

  if (source || medium || campaign) {
    return {
      sourceType: 'campaign',
      source: source || 'campaign',
      medium: medium || 'campaign',
      campaign,
      content,
      term,
    }
  }

  const refHost = referrerUrl?.hostname.replace(/^www\./, '').toLowerCase() || ''
  const currentHost = host?.replace(/^www\./, '').toLowerCase() || ''

  if (!refHost || refHost === currentHost) {
    return {
      sourceType: 'direct',
      source: 'direct',
      medium: null,
      campaign: null,
      content: null,
      term: null,
    }
  }

  if (SEARCH_HOSTS.some(item => refHost.includes(item))) {
    return {
      sourceType: 'search',
      source: refHost,
      medium: 'organic',
      campaign: null,
      content: null,
      term: null,
    }
  }

  if (SOCIAL_HOSTS.some(item => refHost.includes(item))) {
    return {
      sourceType: 'social',
      source: refHost,
      medium: 'social',
      campaign: null,
      content: null,
      term: null,
    }
  }

  return {
    sourceType: 'referral',
    source: refHost,
    medium: 'referral',
    campaign: null,
    content: null,
    term: null,
  }
}

export const ensureVisitorId = (event: any) => {
  let visitorId = getCookie(event, 'visitor_id')
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    setCookie(event, 'visitor_id', visitorId, {
      maxAge: 31536000,
      path: '/',
      sameSite: 'lax',
    })
  }
  return visitorId
}

export const trackVisitorEvent = async (event: any, input: TrackVisitorEventInput) => {
  const visitorId = normalizeValue(input.visitorId) || (event ? ensureVisitorId(event) : null)
  if (!visitorId) return

  const requestUrl = event ? getRequestURL(event) : null
  const host = requestUrl?.host || null
  const userAgent = normalizeValue(input.userAgent) || normalizeValue(event ? getHeader(event, 'user-agent') : null)
  const referrer = normalizeValue(input.referrer) || normalizeValue(event ? getHeader(event, 'referer') : null)
  const path = normalizePath(input.path || referrer, host)
  const attribution = classifySource(path, referrer, host)
  const createdAt = input.createdAt || new Date()
  const country = normalizeValue(input.country) || (event ? readCountry(event) : null)
  const region = normalizeValue(input.region) || (event ? readRegion(event) : null)
  const city = normalizeValue(input.city) || (event ? readCity(event) : null)
  const locale = normalizeValue(input.locale) || normalizeValue(event ? getCookie(event, 'i18n_redirected') : null)
  const currency = normalizeValue(input.currency) || normalizeValue(event ? getCookie(event, 'currency') : null)
  const deviceType = normalizeValue(input.deviceType) || (userAgent ? parseDeviceType(userAgent) : null)
  const browser = normalizeValue(input.browser) || (userAgent ? parseBrowser(userAgent) : null)
  const os = normalizeValue(input.os) || (userAgent ? parseOs(userAgent) : null)

  await db.insert(visitorEvents).values({
    visitorId,
    userId: input.userId || null,
    orderId: input.orderId || null,
    productId: input.productId || null,
    eventName: input.eventName,
    eventAction: input.eventAction || null,
    path,
    referrer,
    sourceType: attribution.sourceType,
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    content: attribution.content,
    term: attribution.term,
    country,
    region,
    city,
    locale,
    currency,
    deviceType,
    browser,
    os,
    userAgent,
    createdAt,
  } as any)

  const existingProfiles = await db.select().from(visitorProfiles).where(eq(visitorProfiles.visitorId, visitorId)).limit(1)
  const profile = existingProfiles[0] as any

  if (!profile) {
    await db.insert(visitorProfiles).values({
      visitorId,
      userId: input.userId || null,
      firstSeenAt: createdAt,
      lastSeenAt: createdAt,
      landingPath: path,
      firstPath: path,
      lastPath: path,
      firstReferrer: referrer,
      lastReferrer: referrer,
      firstSourceType: attribution.sourceType,
      lastSourceType: attribution.sourceType,
      firstSource: attribution.source,
      lastSource: attribution.source,
      firstMedium: attribution.medium,
      lastMedium: attribution.medium,
      firstCampaign: attribution.campaign,
      lastCampaign: attribution.campaign,
      firstContent: attribution.content,
      lastContent: attribution.content,
      firstTerm: attribution.term,
      lastTerm: attribution.term,
      country,
      region,
      city,
      locale,
      currency,
      deviceType,
      browser,
      os,
      userAgent,
      createdAt,
      updatedAt: createdAt,
    } as any)
    return
  }

  const updates: Record<string, any> = {
    lastSeenAt: createdAt,
    lastPath: path || profile.lastPath || null,
    lastReferrer: referrer || profile.lastReferrer || null,
    lastSourceType: attribution.sourceType || profile.lastSourceType || null,
    lastSource: attribution.source || profile.lastSource || null,
    lastMedium: attribution.medium || profile.lastMedium || null,
    lastCampaign: attribution.campaign || profile.lastCampaign || null,
    lastContent: attribution.content || profile.lastContent || null,
    lastTerm: attribution.term || profile.lastTerm || null,
    country: country || profile.country || null,
    region: region || profile.region || null,
    city: city || profile.city || null,
    locale: locale || profile.locale || null,
    currency: currency || profile.currency || null,
    deviceType: deviceType || profile.deviceType || null,
    browser: browser || profile.browser || null,
    os: os || profile.os || null,
    userAgent: userAgent || profile.userAgent || null,
    updatedAt: createdAt,
  }

  if (input.userId && !profile.userId) {
    updates.userId = input.userId
  }

  await db.update(visitorProfiles).set(updates as any).where(eq(visitorProfiles.visitorId, visitorId))
}
