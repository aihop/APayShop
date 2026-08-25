import { computed } from 'vue'
import { classifySeoRoute, safeJsonLd, stripLocalePrefix, type SeoRouteRegistry } from '~~/shared/siteSeo'
import { seoRouteRegistry } from '~~/shared/generated/seo-routes'

const LIST_PATHS = new Set(['/products', '/blog', '/apps', '/theme'])

const resolveAbsoluteUrl = (value: string, base: string) => {
  try {
    const url = new URL(value, base)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

const parseJsonLdGraph = (value: string) => {
  try {
    const payload = JSON.parse(value) as { '@graph'?: Array<Record<string, unknown>> }
    return Array.isArray(payload['@graph']) ? { payload, graph: payload['@graph'] } : null
  } catch {
    return null
  }
}

export default defineNuxtPlugin({
  name: 'apay-seo-social-and-pagination',
  dependsOn: ['i18n:plugin'],
  setup() {
    const nuxtApp = useNuxtApp()
    const route = useRoute()
    const activeTheme = useActiveTheme()
    const locales = computed(() => (nuxtApp.$i18n.locales.value || []).map(item => typeof item === 'string' ? item : item.code))
    const routePath = computed(() => stripLocalePrefix(route.path, locales.value))
    const routePolicy = computed(() => classifySeoRoute(seoRouteRegistry as SeoRouteRegistry, activeTheme.value, routePath.value))
    const pageQuery = computed(() => Number(route.query.page || 1))
    const paginatedList = computed(() => LIST_PATHS.has(routePath.value) && routePolicy.value.kind === 'public')
    const paginationNoIndex = computed(() => paginatedList.value && (!Number.isInteger(pageQuery.value) || pageQuery.value > 1 || pageQuery.value < 1))

    useSeoMeta({
      robots: () => paginationNoIndex.value ? 'noindex,follow' : undefined,
    })

    const head = nuxtApp.ssrContext?.head || injectHead(nuxtApp)
    head.hooks.hook('tags:afterResolve', ({ tagMap, tags }) => {
      const findMeta = (property: string) => {
        const tag = tags.find(item => item.tag === 'meta' && (item.props.property === property || item.props.name === property))
        return typeof tag?.props.content === 'string' ? tag.props.content.trim() : ''
      }
      const title = tagMap.get('title')?.textContent || ''
      const description = findMeta('og:description') || findMeta('description')
      const canonical = tags.find(item => item.tag === 'link' && item.props.rel === 'canonical')?.props.href || ''
      const rawImage = findMeta('og:image')
      const image = rawImage && canonical ? resolveAbsoluteUrl(rawImage, canonical) : ''
      if (routePolicy.value.kind !== 'public' || findMeta('robots').includes('noindex')) return
      const values = [
        ['twitter:card', image ? 'summary_large_image' : 'summary'],
        ['twitter:title', findMeta('og:title') || title],
        ['twitter:description', description],
        ['twitter:image', image],
      ] as const
      for (const [name, content] of values) {
        if (!content || tags.some(item => item.tag === 'meta' && item.props.name === name)) continue
        tags.push({ tag: 'meta', props: { name, content } })
      }

      const jsonLd = tags.find(item => item.tag === 'script' && item.props.type === 'application/ld+json')
      if (!jsonLd?.textContent || !canonical) return
      const parsed = parseJsonLdGraph(jsonLd.textContent)
      if (!parsed) return
      const { payload, graph } = parsed
      const website = graph.find(node => node['@type'] === 'WebSite')
      const collectionPage = graph.find(node => node['@type'] === 'CollectionPage')
      if (collectionPage) {
        const itemList = graph.find(node => node['@type'] === 'ItemList')
        collectionPage.isPartOf = website?.['@id'] ? { '@id': website['@id'] } : undefined
        collectionPage.mainEntity = itemList?.['@id'] ? { '@id': itemList['@id'] } : undefined
        jsonLd.textContent = safeJsonLd({ ...payload, '@graph': graph })
        return
      }
      if (graph.some(node => node['@type'] === 'WebPage')) return
      const mainEntity = graph.find(node => ['Product', 'BlogPosting', 'SoftwareApplication'].includes(String(node['@type'] || '')))
      const webPage: Record<string, unknown> = {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description: description || undefined,
        inLanguage: website?.inLanguage,
        isPartOf: website?.['@id'] ? { '@id': website['@id'] } : undefined,
        mainEntity: mainEntity?.['@id'] ? { '@id': mainEntity['@id'] } : undefined,
      }
      graph.push(webPage)
      jsonLd.textContent = safeJsonLd({ ...payload, '@graph': graph })
    })
  },
})
