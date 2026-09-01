import type { H3Event } from 'h3'
import { sendRedirect, setCookie } from 'h3'
import { getRequestLocale } from './requestLocale'

export const SUPPORTED_LOCALES = ['en', 'zh', 'zh-HK', 'ru'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

export function resolveConfiguredDefaultLocale(): SupportedLocale {
  const preferred = String(process.env.APAY_DEFAULT_LOCALE || '').trim()
  if (preferred === 'zh' || preferred === 'zh-HK' || preferred === 'ru' || preferred === 'en') {
    return preferred
  }
  return 'en'
}

export function normalizeSupportedLocale(value: unknown): SupportedLocale {
  const normalized = String(value || '').trim().replace(/_/g, '-')
  if (!normalized) return resolveConfiguredDefaultLocale()

  const lower = normalized.toLowerCase()
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans') return 'zh'
  if (lower === 'zh-hk' || lower === 'zh-tw' || lower === 'zh-hant') return 'zh-HK'
  if (lower === 'ru' || lower.startsWith('ru-')) return 'ru'
  if (lower === 'en' || lower.startsWith('en-')) return 'en'

  return resolveConfiguredDefaultLocale()
}

/**
 * 格式化前台本地化路由
 *
 * 遵循 Nuxt i18n 的 prefix_except_default 策略：
 * - 默认语言（如 en）无前缀：`/auth/login`
 * - 非默认语言（如 zh）带前缀：`/zh/auth/login`、`/ru/auth/login`
 */
export function buildLocalizedPath(path: string, locale?: unknown): string {
  const targetLocale = normalizeSupportedLocale(locale)
  const defaultLocale = resolveConfiguredDefaultLocale()

  const cleanPath = String(path || '/').trim()
  const [pathnameAndSearch, hashPart] = cleanPath.split('#', 2)
  const [rawPath, searchPart] = (pathnameAndSearch || '/').split('?', 2)

  // 移除开头已经包含的语言前缀（如果有的话，避免重复叠加）
  let normalizedPath = `/${(rawPath || '').replace(/^\/+|\/+$/g, '')}`
  if (normalizedPath === '/') normalizedPath = ''

  for (const loc of SUPPORTED_LOCALES) {
    if (normalizedPath === `/${loc}` || normalizedPath.startsWith(`/${loc}/`)) {
      normalizedPath = normalizedPath.slice(loc.length + 1)
      break
    }
  }

  const localizedBasePath = targetLocale === defaultLocale
    ? (normalizedPath || '/')
    : `/${targetLocale}${normalizedPath}`

  const queryString = searchPart ? `?${searchPart}` : ''
  const hashString = hashPart ? `#${hashPart}` : ''

  return `${localizedBasePath}${queryString}${hashString}`
}

/**
 * 发送带语言上下文的统一重定向
 *
 * 1. 自动计算本地化后的前台路由；
 * 2. 自动写入 i18n_redirected Cookie，保证浏览器后续页面与 SSR 水合保持语言一致。
 */
export function sendLocalizedRedirect(
  event: H3Event,
  path: string,
  locale?: unknown,
  status: number = 302,
) {
  const resolvedLocale = locale ? normalizeSupportedLocale(locale) : getRequestLocale(event)
  const targetUrl = buildLocalizedPath(path, resolvedLocale)

  // 写入 i18n Cookie 同步前端语言持久化
  try {
    setCookie(event, 'i18n_redirected', resolvedLocale, {
      path: '/',
      maxAge: 365 * 86400,
      sameSite: 'lax',
      httpOnly: false,
    })
  } catch (err) {
    console.warn('[sendLocalizedRedirect] failed to set i18n cookie:', err)
  }

  return sendRedirect(event, targetUrl, status)
}
