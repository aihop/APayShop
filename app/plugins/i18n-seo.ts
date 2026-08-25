import type { DomainLocaleMap } from '../../shared/domainLocales'
import { classifySeoRoute, localePathForSeo, normalizeSiteOrigin, safeJsonLd, stripLocalePrefix } from '~~/shared/siteSeo'
import { seoRouteRegistry } from '~~/shared/generated/seo-routes'
import { resolveLocalizedSetting } from '~~/shared/utils/localizedSettings'

export default defineNuxtPlugin({
  name: 'apay-domain-locale-seo',
  dependsOn: ['i18n:plugin'],
  setup() {
    const nuxtApp = useNuxtApp()
    const config = useRuntimeConfig()
    const route = useRoute()
    const switchLocalePath = useSwitchLocalePath()
    type LocaleCode = Parameters<typeof switchLocalePath>[0]
    const { locale, locales } = nuxtApp.$i18n
    const requestUrl = useRequestURL()
    const { settings, getSetting } = useSettings()
    const getLocalizedSetting = (key: string, defaultValue = '') => (
      resolveLocalizedSetting(settings.value, key, locale.value, defaultValue)
    )
    const activeTheme = useActiveTheme()
    const entityRegistry = useState<Record<string, Record<string, unknown>[]>>('apay-json-ld-nodes', () => ({}))
    const mappings = (config.public.apayDomainLocales || {}) as DomainLocaleMap
    const host = computed(() => requestUrl.host.toLowerCase())
    const origin = computed(() => {
      if (Object.keys(mappings).length) {
        if (!mappings[host.value]) return ''
        const protocol = config.public.apayPublicProtocol || requestUrl.protocol.replace(/:$/, '')
        return `${protocol}://${host.value}`
      }
      return normalizeSiteOrigin(getSetting('site_url'))
    })
    const localeEntries = computed(() => (locales.value || []).map(item => (
      typeof item === 'string' ? { code: item, language: item } : item
    )))
    const absoluteUrl = (path: string) => {
      const candidate = new URL(path || '/', origin.value)
      const url = new URL(candidate.pathname, origin.value)
      url.search = ''
      url.hash = ''
      return url.toString()
    }
    const absoluteEntityUrl = (value: string) => new URL(value, origin.value).toString()
    const localePath = (code: LocaleCode) => switchLocalePath(code) || (route.path === '/' ? '/' : '')

    const routePath = computed(() => stripLocalePrefix(route.path, localeEntries.value.map(item => item.code)))
    const routePolicy = computed(() => classifySeoRoute(seoRouteRegistry, activeTheme.value, routePath.value))
    const entityNodes = computed(() => Object.values(entityRegistry.value).flat())
    const isIndexable = computed(() => (
      routePolicy.value.kind === 'public'
      && Boolean(origin.value)
      && (!routePolicy.value.source || entityNodes.value.length > 0)
    ))

    useSeoMeta({
      robots: () => isIndexable.value ? 'index,follow' : 'noindex,follow',
      ogUrl: () => isIndexable.value ? absoluteUrl(route.path) : undefined,
    })

    useHead(() => {
      if (!isIndexable.value) return {}

      const current = localeEntries.value.find(item => item.code === locale.value)
      const links = localeEntries.value.flatMap((item) => {
        const path = localePath(item.code as LocaleCode)
        return path
          ? [{
              key: `apay-domain-locale-${item.code}`,
              rel: 'alternate',
              hreflang: item.language || item.code,
              href: absoluteUrl(path),
            }]
          : []
      })
      const defaultLocale = mappings[host.value] || String(config.public.apayDefaultLocale || '')
      const defaultPath = defaultLocale
        ? localePath(defaultLocale as LocaleCode)
        : ''
      if (defaultPath) {
        links.unshift({
          key: 'apay-domain-locale-x-default',
          rel: 'alternate',
          hreflang: 'x-default',
          href: absoluteUrl(defaultPath),
        })
      }

      const siteName = getLocalizedSetting('site_name', 'APay')
      const siteDescription = getLocalizedSetting('site_description')
      const homeUrl = absoluteUrl('/')
      const websiteUrl = absoluteUrl(localePathForSeo('/', locale.value, defaultLocale))
      const rawLogo = getLocalizedSetting('site_logo')
      let logo: string | undefined
      try {
        const logoUrl = rawLogo ? new URL(rawLogo, origin.value) : null
        logo = logoUrl && ['http:', 'https:'].includes(logoUrl.protocol) ? logoUrl.toString() : undefined
      } catch {
        logo = undefined
      }
      const graph = [
        {
          '@type': 'Organization',
          '@id': `${homeUrl}#organization`,
          name: getLocalizedSetting('company_name', siteName),
          url: homeUrl,
          logo,
        },
        {
          '@type': 'WebSite',
          '@id': `${websiteUrl}#website`,
          url: websiteUrl,
          name: siteName,
          description: siteDescription || undefined,
          inLanguage: current?.language || locale.value,
          publisher: { '@id': `${homeUrl}#organization` },
        },
        ...entityNodes.value.map((node) => {
          const normalized = { ...node }
          for (const key of ['@id', 'url', 'mainEntityOfPage']) {
            if (typeof normalized[key] === 'string' && String(normalized[key]).startsWith('/')) normalized[key] = absoluteEntityUrl(String(normalized[key]))
          }
          if (typeof normalized.image === 'string' && normalized.image.startsWith('/')) normalized.image = absoluteEntityUrl(normalized.image)
          if (Array.isArray(normalized.image)) normalized.image = normalized.image.map(image => typeof image === 'string' && image.startsWith('/') ? absoluteEntityUrl(image) : image)
          if (Array.isArray(normalized.downloadUrl)) normalized.downloadUrl = normalized.downloadUrl.map(url => typeof url === 'string' && url.startsWith('/') ? absoluteEntityUrl(url) : url)
          if (normalized.offers && typeof normalized.offers === 'object') {
            const offers = { ...(normalized.offers as Record<string, unknown>) }
            if (typeof offers.url === 'string' && offers.url.startsWith('/')) offers.url = absoluteEntityUrl(offers.url)
            normalized.offers = offers
          }
          if (normalized.itemListElement && Array.isArray(normalized.itemListElement)) {
            normalized.itemListElement = normalized.itemListElement.map((item) => {
              if (!item || typeof item !== 'object') return item
              const result = { ...(item as Record<string, unknown>) }
              if (typeof result.item === 'string' && result.item.startsWith('/')) result.item = absoluteEntityUrl(result.item)
              return result
            })
          }
          return normalized
        }),
      ]

      return {
        htmlAttrs: { lang: current?.language || locale.value },
        link: [
          { key: 'apay-domain-locale-canonical', rel: 'canonical', href: absoluteUrl(route.path) },
          ...links,
        ],
        script: [{
          key: 'apay-json-ld',
          type: 'application/ld+json',
          textContent: safeJsonLd({ '@context': 'https://schema.org', '@graph': graph }),
        }],
      }
    })
  },
})
