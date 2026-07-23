import { capturePromoTracking } from '../promo/service'

export default defineEventHandler(async (event) => {
  const path = event.path
  const normalizedPath = path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')

  // Only capture tracking codes on frontend page visits.
  if (normalizedPath.startsWith('/api') || normalizedPath.startsWith('/admin')) {
    return
  }

  await capturePromoTracking(event)
})
