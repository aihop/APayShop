export const SEO_LOCALE_LANGUAGE = {
  en: 'en-US',
  zh: 'zh-CN',
  'zh-HK': 'zh-HK',
  id: 'id-ID',
  ru: 'ru-RU',
} as const

export type SeoRouteKind = 'public' | 'private' | 'redirect' | 'unknown'
export type SeoDynamicSource = 'products' | 'posts' | 'shoply-apps' | 'shoply-themes'

export interface SeoDynamicRoute {
  pattern: string
  source?: SeoDynamicSource
}

export interface SeoRouteManifest {
  public: string[]
  dynamic: SeoDynamicRoute[]
  private: string[]
  redirect: string[]
  suppressCore?: string[]
}

export interface SeoRouteRegistry {
  core: SeoRouteManifest
  themes: Record<string, SeoRouteManifest>
}

const normalizePath = (value: unknown): string => {
  const path = String(value || '/').split(/[?#]/, 1)[0] || '/'
  const normalized = `/${path.replace(/^\/+|\/+$/g, '')}`
  return normalized === '/' ? '/' : normalized.replace(/\/{2,}/g, '/')
}

const matchesPattern = (path: string, pattern: string): boolean => {
  const normalizedPath = normalizePath(path)
  const normalizedPattern = normalizePath(pattern)
  if (normalizedPattern.endsWith('/**')) {
    const prefix = normalizedPattern.slice(0, -3)
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  }
  const pathParts = normalizedPath.split('/').filter(Boolean)
  const patternParts = normalizedPattern.split('/').filter(Boolean)
  if (pathParts.length !== patternParts.length) return false
  return patternParts.every((part, index) => part.startsWith(':') || part === pathParts[index])
}

export function stripLocalePrefix(path: unknown, locales: readonly string[]): string {
  const normalized = normalizePath(path)
  const parts = normalized.split('/').filter(Boolean)
  if (parts[0] && locales.includes(parts[0])) parts.shift()
  return normalizePath(parts.join('/'))
}

export function classifySeoRoute(
  registry: SeoRouteRegistry,
  theme: string,
  path: string,
): { kind: SeoRouteKind, source?: SeoDynamicSource } {
  const privatePrefixes = ['/admin/**', '/api/**', '/auth/**', '/user/**', '/payment/**', '/callback/**', '/app/**']
  if (privatePrefixes.some(pattern => matchesPattern(path, pattern))) return { kind: 'private' }

  const themeManifest = registry.themes[theme]
  if (themeManifest) {
    if (themeManifest.private.some(pattern => matchesPattern(path, pattern))) return { kind: 'private' }
    if (themeManifest.redirect.some(pattern => matchesPattern(path, pattern))) return { kind: 'redirect' }
    if (themeManifest.public.some(pattern => matchesPattern(path, pattern))) return { kind: 'public' }
    const dynamic = themeManifest.dynamic.find(route => matchesPattern(path, route.pattern))
    if (dynamic) return { kind: 'public', source: dynamic.source }
    if (themeManifest.suppressCore?.some(pattern => matchesPattern(path, pattern))) return { kind: 'unknown' }
  }

  if (registry.core.private.some(pattern => matchesPattern(path, pattern))) return { kind: 'private' }
  if (registry.core.redirect.some(pattern => matchesPattern(path, pattern))) return { kind: 'redirect' }
  if (registry.core.public.some(pattern => matchesPattern(path, pattern))) return { kind: 'public' }
  const coreDynamic = registry.core.dynamic.find(route => matchesPattern(path, route.pattern))
  return coreDynamic ? { kind: 'public', source: coreDynamic.source } : { kind: 'unknown' }
}

export function normalizeSiteOrigin(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    if (url.pathname !== '/' || url.search || url.hash) return ''
    return url.origin
  } catch {
    return ''
  }
}

export function absoluteSeoUrl(origin: string, path: string): string {
  const url = new URL(normalizePath(path), origin)
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function localePathForSeo(path: string, locale: string, defaultLocale: string): string {
  const normalized = normalizePath(path)
  return locale === defaultLocale
    ? normalized
    : normalizePath(`/${locale}${normalized === '/' ? '' : normalized}`)
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function normalizeIsoDate(value: unknown): string | undefined {
  if (!value) return undefined
  const date = new Date(String(value))
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString()
}
