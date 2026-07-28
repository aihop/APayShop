import { getHeader, getRequestIP } from 'h3'
import { lookupLocalGeo } from '#geoip-local'

export type RequestGeo = {
  ip: string | null
  country: string | null
  region: string | null
  city: string | null
  timezone: string | null
  source: 'cloudflare' | 'proxy' | 'geolite2' | 'request' | null
}

const normalizeValue = (value?: string | null) => {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    return decodeURIComponent(trimmed).slice(0, 500)
  } catch {
    return trimmed.slice(0, 500)
  }
}

const normalizeIp = (value?: string | null) => {
  let ip = normalizeValue(value)?.split(',')[0]?.trim() || null
  if (!ip) return null
  if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']'))
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'))
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  return ip || null
}

export const isPublicIp = (ip: string | null) => {
  if (!ip) return false
  const normalized = ip.toLowerCase()
  if (normalized === 'localhost' || normalized === '::1' || normalized === '::') return false
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return false

  const parts = normalized.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return normalized.includes(':')
  }

  const [first = 0, second = 0] = parts
  return !(
    first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || first >= 224
  )
}

const trustsProxy = () => ['1', 'true', 'yes', 'on'].includes(
  String(process.env.APAY_TRUST_PROXY || '').trim().toLowerCase()
)

export const resolveRequestGeo = async (event: any): Promise<RequestGeo> => {
  const trustProxy = trustsProxy()
  const isCloudflareRuntime = Boolean(event?.context?._platform?.cloudflare || event?.context?.cloudflare)
  const trustCloudflareHeaders = trustProxy || isCloudflareRuntime
  const cloudflareIp = trustCloudflareHeaders
    ? normalizeIp(getHeader(event, 'cf-connecting-ip'))
    : null
  const proxyIp = trustProxy
    ? normalizeIp(getHeader(event, 'x-real-ip') || getHeader(event, 'x-forwarded-for'))
    : null
  const requestIp = normalizeIp(getRequestIP(event))
  const ip = cloudflareIp || proxyIp || requestIp

  const cloudflareCountry = trustCloudflareHeaders
    ? normalizeValue(getHeader(event, 'cf-ipcountry'))?.toUpperCase() || null
    : null
  const cloudflareRegion = trustCloudflareHeaders
    ? normalizeValue(getHeader(event, 'cf-region') || getHeader(event, 'cf-region-code'))
    : null
  const cloudflareCity = trustCloudflareHeaders
    ? normalizeValue(getHeader(event, 'cf-ipcity'))
    : null
  const cloudflareTimezone = trustCloudflareHeaders
    ? normalizeValue(getHeader(event, 'cf-timezone'))
    : null

  const proxyCountry = trustProxy
    ? normalizeValue(getHeader(event, 'x-geo-country') || getHeader(event, 'x-country-code'))?.toUpperCase() || null
    : null
  const proxyRegion = trustProxy
    ? normalizeValue(getHeader(event, 'x-geo-region') || getHeader(event, 'x-region'))
    : null
  const proxyCity = trustProxy
    ? normalizeValue(getHeader(event, 'x-geo-city') || getHeader(event, 'x-city'))
    : null
  const proxyTimezone = trustProxy
    ? normalizeValue(getHeader(event, 'x-geo-timezone'))
    : null

  let country = cloudflareCountry || proxyCountry
  let region = cloudflareRegion || proxyRegion
  let city = cloudflareCity || proxyCity
  let timezone = cloudflareTimezone || proxyTimezone
  let source: RequestGeo['source'] = cloudflareIp || cloudflareCountry ? 'cloudflare' : proxyIp ? 'proxy' : ip ? 'request' : null

  if (isPublicIp(ip) && (!country || !region || !city || !timezone)) {
    const localGeo = await lookupLocalGeo(ip as string)
    if (localGeo) {
      country ||= localGeo.country
      region ||= localGeo.region
      city ||= localGeo.city
      timezone ||= localGeo.timezone
      if (source === 'request') source = 'geolite2'
    }
  }

  return { ip, country, region, city, timezone, source }
}
