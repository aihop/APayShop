import type { H3Event } from 'h3'
import { getCookie, getHeader } from 'h3'
import { resolveRequestDomainLocale } from './domainLocale'

function messageLocale(value: unknown): 'zh' | 'en' | '' {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-')
  if (!normalized) return ''
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh'
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  if (normalized === 'ru' || normalized.startsWith('ru-')) return 'en'
  return ''
}

function localeFromReferer(event: H3Event): 'zh' | 'en' | '' {
  const referer = String(getHeader(event, 'referer') || '').trim()
  if (!referer) return ''
  try {
    const segment = new URL(referer).pathname.split('/').filter(Boolean)[0] || ''
    if (!/^(?:en|zh|ru)(?:-[a-z]{2})?$/i.test(segment)) return ''
    return messageLocale(segment)
  } catch {
    return ''
  }
}

export function getRequestLocale(event: H3Event): 'zh' | 'en' {
  const pathSegment = event.path.split('/').filter(Boolean)[0] || ''
  const pathLocale = /^(?:en|zh|ru)(?:-[a-z]{2})?$/i.test(pathSegment) ? messageLocale(pathSegment) : ''
  const cookieLocale = messageLocale(getCookie(event, 'i18n_redirected'))
  const refererLocale = localeFromReferer(event)
  const domainLocale = messageLocale(resolveRequestDomainLocale(event))
  const acceptLanguage = messageLocale(String(getHeader(event, 'accept-language') || '').split(',')[0])
  return pathLocale || cookieLocale || refererLocale || domainLocale || acceptLanguage || 'en'
}
