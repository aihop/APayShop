import { getRequestPath, getMethod, getHeader, getRequestIP, getCookie } from 'h3'
import { db } from '../db/runtime'
import { accessLogs } from '../db/schema'

const EXCLUDED_PREFIXES = [
  '/api/admin/access-logs',
  '/api/admin/operation-logs',
  '/api/analytics/track',
  '/api/admin/login',
  '/api/admin/logout',
  '/__nuxt_devtools',
  '/favicon',
  '/_nuxt/',
  '/robots.txt',
]

const shouldSkip = (path: string) =>
  EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix))

const parseDeviceType = (userAgent: string) => {
  const ua = userAgent.toLowerCase()
  if (/bot|crawler|spider|headless/.test(ua)) return 'bot'
  if (/ipad|tablet/.test(ua)) return 'tablet'
  if (/mobi|iphone|android/.test(ua)) return 'mobile'
  return 'desktop'
}

export default defineNitroPlugin((nitroApp) => {
  // Capture request start time
  nitroApp.hooks.hook('request', (event) => {
    ;(event.context as any).__accessStart = Date.now()
  })

  // Log access after response is sent
  nitroApp.hooks.hook('afterResponse', async (event, response) => {
    const path = getRequestPath(event)
    if (shouldSkip(path)) return

    const startTime = (event.context as any).__accessStart || Date.now()
    const duration = Date.now() - startTime
    const statusCode = (response as any)?.status || 200

    try {
      const userAgent = getHeader(event, 'user-agent') || ''
      await db.insert(accessLogs).values({
        path,
        method: getMethod(event) || 'GET',
        ip: getRequestIP(event, { xForwardedFor: true }) || null,
        userAgent: userAgent.slice(0, 500) || null,
        referrer: getHeader(event, 'referer')?.slice(0, 1000) || null,
        statusCode,
        duration,
        visitorId: getCookie(event, 'visitor_id') || null,
        createdAt: new Date(),
      } as any)
    } catch (err) {
      // Silently fail - logging should never crash the request
      console.error('[access-log] Failed to record:', err)
    }
  })
})
