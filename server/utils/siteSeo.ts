import type { H3Event } from 'h3'
import { inArray } from 'drizzle-orm'
import { settings } from '../db/schema'
import { db } from '../db/runtime'
import { hasDomainLocaleMappings, requireTrustedRequestOrigin, resolveRequestDomain } from './domainLocale'
import { normalizeSiteOrigin } from '~~/shared/siteSeo'

interface PublicLocaleEntry {
  code: string
  language: string
}

const readSeoSettings = async () => {
  const rows = await db.select().from(settings).where(inArray(settings.key, ['active_theme', 'site_url']))
  return Object.fromEntries(rows.map((row: { key: string, value: string }) => [row.key, row.value]))
}

export async function resolveServerSeoContext(event: H3Event) {
  const config = useRuntimeConfig(event)
  const values = await readSeoSettings()
  const buildThemes = Array.isArray(config.public.apayBuildThemes)
    ? config.public.apayBuildThemes.map(String)
    : []
  const configuredTheme = String(values.active_theme || '')
  const theme = buildThemes.includes(configuredTheme) ? configuredTheme : ''
  const locales = (Array.isArray(config.public.apayLocales) ? config.public.apayLocales : [])
    .flatMap((entry): PublicLocaleEntry[] => {
      if (!entry || typeof entry !== 'object') return []
      const value = entry as Record<string, unknown>
      const code = String(value.code || '')
      return code ? [{ code, language: String(value.language || code) }] : []
    })
  const mappedDomain = resolveRequestDomain(event)
  const defaultLocale = mappedDomain?.locale || String(config.public.apayDefaultLocale || locales[0]?.code || 'en')
  const origin = hasDomainLocaleMappings(event)
    ? requireTrustedRequestOrigin(event)
    : normalizeSiteOrigin(values.site_url)

  return { origin, theme, locales, defaultLocale }
}
