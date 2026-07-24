import type { H3Event } from 'h3'
import { getHeader } from 'h3'

export function getRequestLocale(event: H3Event): 'zh' | 'en' {
  const acceptLanguage = String(getHeader(event, 'accept-language') || '').toLowerCase()
  return acceptLanguage.startsWith('zh') ? 'zh' : 'en'
}
