import { getCookie, setCookie } from 'h3'
import { resolveRequestGeo } from '../utils/requestGeo'

// Map of ISO country codes to their default currency
const countryCurrencyMap: Record<string, string> = {
  'US': 'USD',
  'GB': 'GBP',
  'JP': 'JPY',
  'CN': 'CNY',
  'EU': 'EUR', // Fallback for Eurozone
  'FR': 'EUR',
  'DE': 'EUR',
  'IT': 'EUR',
  'ES': 'EUR',
  'KR': 'KRW',
  'AU': 'AUD',
  'CA': 'CAD',
  'SG': 'SGD',
  // Add more as needed...
}

// Map of ISO country codes to their default locale
const countryLocaleMap: Record<string, string> = {
  'US': 'en',
  'GB': 'en',
  'AU': 'en',
  'CN': 'zh',
  'TW': 'zh',
  'HK': 'zh',
  'JP': 'ja',
  'KR': 'ko',
  'FR': 'fr',
  'DE': 'de',
  'ES': 'es',
}

export default defineEventHandler(async (event) => {
  // Only apply to frontend routes, skip API and Admin
  const path = event.path
  const normalizedPath = path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')
  if (normalizedPath.startsWith('/api') || normalizedPath.startsWith('/admin')) {
    return
  }

  let currency = getCookie(event, 'currency')
  let userLocale = getCookie(event, 'i18n_redirected')

  // If both are already set, we don't need to do IP lookup
  if (currency && userLocale) {
    return
  }

  try {
    const geo = await resolveRequestGeo(event)

    if (geo.country) {
      const countryCode = geo.country

      if (!currency) {
        currency = countryCurrencyMap[countryCode] || 'USD'
        setCookie(event, 'currency', currency, { maxAge: 60 * 60 * 24 * 30 }) // 30 days
      }

      if (!userLocale) {
        userLocale = countryLocaleMap[countryCode] || 'en'
        setCookie(event, 'i18n_redirected', userLocale, { maxAge: 60 * 60 * 24 * 30 }) // Nuxt i18n cookie
      }
    } else {
      // Localhost defaults
      if (!currency) setCookie(event, 'currency', 'USD', { maxAge: 60 * 60 * 24 * 30 })
      if (!userLocale) setCookie(event, 'i18n_redirected', 'en', { maxAge: 60 * 60 * 24 * 30 })
    }
  } catch (e) {
    console.error('[GeoIP Middleware] Failed to detect user location', e)
  }
})
