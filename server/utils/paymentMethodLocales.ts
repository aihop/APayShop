import { inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getCookie, getHeader } from 'h3'
import { db } from '../db/runtime'
import { settings } from '../db/schema'

type SiteLocaleConfig = {
  supportedLocales: string[]
  defaultLocale: string
}

const FALLBACK_SUPPORTED_LOCALES = ['en', 'zh']
const FALLBACK_DEFAULT_LOCALE = 'en'

function canonicalizeLocale(value: string) {
  const normalized = String(value || '')
    .trim()
    .replace(/_/g, '-')

  if (!normalized) return ''

  const [language, region, ...rest] = normalized.split('-').filter(Boolean)
  if (!language) return ''

  const parts = [language.toLowerCase()]
  if (region) parts.push(region.length <= 3 ? region.toUpperCase() : region.toLowerCase())
  if (rest.length) parts.push(...rest.map(part => part.toLowerCase()))
  return parts.join('-')
}

export function parseLocaleCsv(raw: unknown) {
  return Array.from(
    new Set(
      String(raw || '')
        .split(',')
        .map(item => canonicalizeLocale(item))
        .filter(Boolean)
    )
  )
}

function resolveSupportedLocale(requested: unknown, supportedLocales: string[], defaultLocale: string) {
  const normalizedRequested = canonicalizeLocale(String(requested || ''))
  const normalizedSupported = supportedLocales.map(locale => canonicalizeLocale(locale))

  if (!normalizedRequested) {
    return defaultLocale
  }

  const exactIndex = normalizedSupported.findIndex(locale => locale === normalizedRequested)
  if (exactIndex !== -1) {
    return supportedLocales[exactIndex] || defaultLocale
  }

  const requestedLanguage = normalizedRequested.split('-')[0] || ''
  const languageIndex = normalizedSupported.findIndex(locale => locale.split('-')[0] === requestedLanguage)
  if (languageIndex !== -1) {
    return supportedLocales[languageIndex] || defaultLocale
  }

  return defaultLocale
}

function localeFromReferer(event: H3Event) {
  const referer = String(getHeader(event, 'referer') || '').trim()
  if (!referer) return ''

  try {
    const pathname = new URL(referer).pathname
    const firstSegment = pathname.split('/').filter(Boolean)[0] || ''
    return canonicalizeLocale(firstSegment)
  } catch {
    return ''
  }
}

function localeFromAcceptLanguage(event: H3Event) {
  const acceptLanguage = String(getHeader(event, 'accept-language') || '')
  if (!acceptLanguage) return ''

  const firstPreference = acceptLanguage
    .split(',')
    .map(item => item.split(';')[0]?.trim() || '')
    .find(Boolean)

  return canonicalizeLocale(firstPreference || '')
}

export async function getSiteLocaleConfig(): Promise<SiteLocaleConfig> {
  const rows = await db.select().from(settings).where(
    inArray(settings.key, ['supported_locales', 'default_locale'])
  ) as Array<{ key: string, value: string | null }>

  const supportedLocalesSetting = rows.find(item => item.key === 'supported_locales')?.value || ''
  const defaultLocaleSetting = rows.find(item => item.key === 'default_locale')?.value || ''

  const supportedLocales = parseLocaleCsv(supportedLocalesSetting)
  const safeSupportedLocales = supportedLocales.length
    ? supportedLocales
    : FALLBACK_SUPPORTED_LOCALES
  const defaultLocale = resolveSupportedLocale(
    defaultLocaleSetting || safeSupportedLocales[0] || FALLBACK_DEFAULT_LOCALE,
    safeSupportedLocales,
    safeSupportedLocales[0] || FALLBACK_DEFAULT_LOCALE
  )

  return {
    supportedLocales: safeSupportedLocales,
    defaultLocale,
  }
}

export function resolveRequestLocale(event: H3Event, inputLocale: unknown, config: SiteLocaleConfig) {
  const cookieLocale = canonicalizeLocale(getCookie(event, 'i18n_redirected') || '')
  const refererLocale = localeFromReferer(event)
  const acceptLanguageLocale = localeFromAcceptLanguage(event)

  return resolveSupportedLocale(
    inputLocale || cookieLocale || refererLocale || acceptLanguageLocale,
    config.supportedLocales,
    config.defaultLocale
  )
}

export function isPaymentMethodAvailableForLocale(
  method: { supportedLocales?: string | null },
  locale: string,
  config: SiteLocaleConfig
) {
  const requestedLocale = resolveSupportedLocale(locale, config.supportedLocales, config.defaultLocale)
  const methodLocales = parseLocaleCsv(method.supportedLocales)

  // 空值代表不限制语言，沿用全站可用。
  if (!methodLocales.length) {
    return true
  }

  const requestedCanonical = canonicalizeLocale(requestedLocale)
  const allowedCanonical = methodLocales
    .map(item => resolveSupportedLocale(item, config.supportedLocales, ''))
    .filter(Boolean)
    .map(item => canonicalizeLocale(item))

  if (!allowedCanonical.length) {
    return false
  }

  return allowedCanonical.includes(requestedCanonical)
}
