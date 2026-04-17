export default defineNuxtPlugin((nuxtApp) => {
  const visitorId = useCookie('visitor_id', {
    maxAge: 31536000,
    path: '/',
    sameSite: 'lax',
  })

  if (!visitorId.value) {
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      });
    }

    visitorId.value = generateId()
  }

  if (!import.meta.client) {
    return
  }

  const route = useRoute()

  const normalizeAdminPath = (path: string) =>
    path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')

  const shouldTrack = (path: string) => {
    const normalizedPath = normalizeAdminPath(path)
    return !!path && !normalizedPath.startsWith('/admin')
  }

  const getRouteSegments = (path: string) => {
    const pathname = path.split('?')[0] || ''
    const segments = pathname.split('/').filter(Boolean)

    if (/^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0] || '')) {
      return segments.slice(1)
    }

    return segments
  }

  const shouldSend = (eventName: string, path: string) => {
    const bucket = Math.floor(Date.now() / 15000)
    const key = `visitor-analytics:${eventName}:${path}:${bucket}`

    if (sessionStorage.getItem(key)) {
      return false
    }

    sessionStorage.setItem(key, '1')
    return true
  }

  const sendEvent = (payload: Record<string, any>) => {
    const body = JSON.stringify(payload)

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/analytics/track', blob)
      return
    }

    $fetch('/api/analytics/track', {
      method: 'POST',
      body: payload,
    }).catch(() => {})
  }

  const trackCurrentRoute = () => {
    const path = route.fullPath || route.path || '/'
    if (!shouldTrack(path)) {
      return
    }

    if (shouldSend('page_view', path)) {
      sendEvent({
        eventName: 'page_view',
        path,
        referrer: document.referrer || null,
      })
    }

    const segments = getRouteSegments(path)
    if (segments[0] === 'products' && segments[1] && shouldSend('product_view', path)) {
      sendEvent({
        eventName: 'product_view',
        path,
        referrer: document.referrer || null,
      })
    }
  }

  nuxtApp.hook('app:mounted', trackCurrentRoute)
  nuxtApp.hook('page:finish', trackCurrentRoute)
})
