import type { DomainLocaleMap } from '../../shared/domainLocales'

export default defineNuxtPlugin({
  name: 'apay-domain-locale-seo',
  dependsOn: ['i18n:plugin'],
  setup() {
    const nuxtApp = useNuxtApp()
    const config = useRuntimeConfig()
    const mappings = config.public.apayDomainLocales as DomainLocaleMap
    if (!mappings || !Object.keys(mappings).length) return

    const route = useRoute()
    const switchLocalePath = useSwitchLocalePath()
    type LocaleCode = Parameters<typeof switchLocalePath>[0]
    const { locale, locales } = nuxtApp.$i18n
    const requestUrl = useRequestURL()
    const host = computed(() => requestUrl.host.toLowerCase())
    const origin = computed(() => {
      if (!mappings[host.value]) return ''
      const protocol = config.public.apayPublicProtocol || requestUrl.protocol.replace(/:$/, '')
      return `${protocol}://${host.value}`
    })
    const localeEntries = computed(() => (locales.value || []).map(item => (
      typeof item === 'string' ? { code: item, language: item } : item
    )))
    const absoluteUrl = (path: string) => {
      const url = new URL(path || '/', origin.value)
      url.search = ''
      url.hash = ''
      return url.toString()
    }
    const localePath = (code: LocaleCode) => switchLocalePath(code) || (route.path === '/' ? '/' : '')

    useHead(() => {
      if (!origin.value) return {}

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
      const defaultLocale = mappings[host.value]
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

      return {
        htmlAttrs: { lang: current?.language || locale.value },
        link: [
          { key: 'apay-domain-locale-canonical', rel: 'canonical', href: absoluteUrl(route.path) },
          ...links,
        ],
      }
    })
  },
})
