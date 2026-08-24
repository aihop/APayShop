import type { H3Event } from 'h3'
import { createError, getHeader, getRequestHost, getRequestProtocol, getRequestURL } from 'h3'
import {
  normalizeDomainHost,
  normalizePublicProtocol,
  resolveMappedDomain,
  type DomainLocaleMap,
} from '../../shared/domainLocales'

function configuredDomainLocales(event?: H3Event): DomainLocaleMap {
  const value = useRuntimeConfig(event).public.apayDomainLocales
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as DomainLocaleMap
}

export function resolveRequestDomain(event: H3Event): { host: string, locale: string } | null {
  const mappings = configuredDomainLocales(event)
  if (!Object.keys(mappings).length) return null

  const forwardedHeader = String(getHeader(event, 'x-forwarded-host') || '').trim()
  const forwardedHost = forwardedHeader
    ? getRequestHost(event, { xForwardedHost: true })
    : ''
  return resolveMappedDomain(mappings, forwardedHost, getRequestHost(event), Boolean(forwardedHeader))
}

export function resolveRequestDomainLocale(event: H3Event): string {
  return resolveRequestDomain(event)?.locale || ''
}

export function hasDomainLocaleMappings(event?: H3Event): boolean {
  return Object.keys(configuredDomainLocales(event)).length > 0
}

export function requireTrustedRequestOrigin(event: H3Event): string {
  if (!hasDomainLocaleMappings(event)) return getRequestURL(event).origin

  const domain = resolveRequestDomain(event)
  if (!domain) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unrecognized request host',
      message: 'This request host is not configured for this APay deployment',
    })
  }

  const configuredProtocol = normalizePublicProtocol(useRuntimeConfig(event).public.apayPublicProtocol)
  const protocol = configuredProtocol || getRequestProtocol(event)
  return `${protocol}://${domain.host}`
}
