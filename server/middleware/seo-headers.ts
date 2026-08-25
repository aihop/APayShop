import { stripLocalePrefix } from '~~/shared/siteSeo'

const PRIVATE_PREFIXES = ['/admin', '/api', '/auth', '/user', '/payment', '/callback', '/app']

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const locales = (Array.isArray(config.public.apayLocales) ? config.public.apayLocales : [])
    .flatMap((entry) => entry && typeof entry === 'object' ? [String((entry as Record<string, unknown>).code || '')] : [])
    .filter(Boolean)
  const path = stripLocalePrefix(getRequestURL(event).pathname, locales)
  if (PRIVATE_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) {
    setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  }
})
