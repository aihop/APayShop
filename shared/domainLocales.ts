export type DomainLocaleMap = Record<string, string>

const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function normalizeDomainHost(value: unknown): string {
  const input = String(value || '').trim().toLowerCase()
  if (!input) return ''
  if (input.includes('://') || /[/\\?#@\s]/.test(input)) return ''

  const match = input.match(/^([^:]+)(?::(\d{1,5}))?$/)
  if (!match) return ''

  const hostname = String(match[1] || '').replace(/\.$/, '')
  const port = match[2] || ''
  if (!hostname || (port && (Number(port) < 1 || Number(port) > 65535))) return ''
  if (hostname !== 'localhost') {
    const labels = hostname.split('.')
    if (labels.length < 2 || labels.some(label => !HOST_LABEL_PATTERN.test(label))) return ''
  }

  return port ? `${hostname}:${port}` : hostname
}

export function normalizeDomainLocale(value: unknown): string {
  return String(value || '').trim().replace(/_/g, '-').toLowerCase()
}

function readEntries(raw: string): Array<[string, unknown]> {
  const input = raw.trim()
  if (!input) return []

  if (input.startsWith('{')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(input)
    } catch {
      throw new Error('APAY_DOMAIN_LOCALES must be valid JSON or a comma-separated host=locale list')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('APAY_DOMAIN_LOCALES JSON value must be an object')
    }
    return Object.entries(parsed as Record<string, unknown>)
  }

  return input.split(',').map((item) => {
    const separator = item.indexOf('=')
    if (separator <= 0 || separator === item.length - 1) {
      throw new Error(`Invalid APAY_DOMAIN_LOCALES entry: ${item.trim() || '(empty)'}`)
    }
    return [item.slice(0, separator), item.slice(separator + 1)]
  })
}

export function parseDomainLocales(raw: unknown, supportedLocales: readonly string[]): DomainLocaleMap {
  const supported = new Map(
    supportedLocales.map(locale => [normalizeDomainLocale(locale), String(locale)]),
  )
  const result: DomainLocaleMap = {}

  for (const [rawHost, rawLocale] of readEntries(String(raw || ''))) {
    const host = normalizeDomainHost(rawHost)
    const normalizedLocale = normalizeDomainLocale(rawLocale)
    const locale = supported.get(normalizedLocale)
    if (!host) throw new Error(`Invalid domain host in APAY_DOMAIN_LOCALES: ${String(rawHost)}`)
    if (!locale) {
      throw new Error(`Domain ${host} references locale ${String(rawLocale)}, which is not included in APAY_LOCALES`)
    }
    if (result[host] && result[host] !== locale) {
      throw new Error(`Domain ${host} is bound to conflicting locales: ${result[host]} and ${locale}`)
    }
    result[host] = locale
  }

  return result
}

export function normalizePublicProtocol(value: unknown): 'http' | 'https' | '' {
  const protocol = String(value || '').trim().toLowerCase().replace(/:$/, '')
  if (!protocol) return ''
  if (protocol === 'http' || protocol === 'https') return protocol
  throw new Error('APAY_PUBLIC_PROTOCOL must be http or https')
}

export function resolveMappedDomain(
  mappings: DomainLocaleMap,
  forwardedHost: unknown,
  directHost: unknown,
  hasForwardedHost = Boolean(String(forwardedHost || '').trim()),
): { host: string, locale: string } | null {
  const host = normalizeDomainHost(hasForwardedHost ? forwardedHost : directHost)
  return host && mappings[host] ? { host, locale: mappings[host] } : null
}
