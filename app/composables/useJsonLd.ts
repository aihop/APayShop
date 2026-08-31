import type { MaybeRefOrGetter } from 'vue'
import { computed, onBeforeUnmount, toValue, watch } from 'vue'
import { SEO_LOCALE_LANGUAGE } from '~~/shared/siteSeo'

export type JsonLdNode = Record<string, unknown>

export const useJsonLd = (key: string, nodes: MaybeRefOrGetter<JsonLdNode | JsonLdNode[] | null | undefined>) => {
  const registry = useState<Record<string, JsonLdNode[]>>('apay-json-ld-nodes', () => ({}))
  const normalized = computed(() => {
    const value = toValue(nodes)
    return (Array.isArray(value) ? value : value ? [value] : [])
      .filter(node => node && typeof node === 'object' && node['@type'])
  })

  watch(normalized, (val) => {
    registry.value = { ...registry.value, [key]: val }
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (key in registry.value) {
      const next = { ...registry.value }
      delete next[key]
      registry.value = next
    }
  })
}

export const useProductJsonLd = (
  key: string,
  product: MaybeRefOrGetter<Record<string, unknown> | null | undefined>,
) => {
  const route = useRoute()
  const { locale } = useI18n()
  const { currency, convertAmount } = useLocaleCurrency()
  const { getLocalizedSetting } = useLocalizedSettings()
  const localePath = useLocalePath()

  useJsonLd(key, computed(() => {
    const item = toValue(product)
    if (!item?.name) return null
    const slug = String(item.slug || route.params.slug || '')
    const path = localePath(`/products/${slug}`)
    const images = [item.imageUrl, ...(Array.isArray(item.images) ? item.images : []), ...(Array.isArray(item.imageUrls) ? item.imageUrls : [])]
      .map(value => String(value || '').trim())
      .filter(Boolean)
    const name = String(item.name)
    return [
      {
        '@type': 'Product',
        '@id': `${path}#product`,
        name,
        description: String(item.description || item.content || '').replace(/<[^>]+>/g, ' ').trim() || undefined,
        image: [...new Set(images)].length ? [...new Set(images)] : undefined,
        inLanguage: SEO_LOCALE_LANGUAGE[locale.value as keyof typeof SEO_LOCALE_LANGUAGE] || locale.value,
        offers: {
          '@type': 'Offer',
          url: path,
          price: convertAmount(item.price),
          priceCurrency: currency.value,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: getLocalizedSetting('site_name', 'APay'), item: localePath('/') },
          { '@type': 'ListItem', position: 2, name, item: path },
        ],
      },
    ]
  }))
}

export const useBlogPostingJsonLd = (
  key: string,
  post: MaybeRefOrGetter<Record<string, unknown> | null | undefined>,
) => {
  const route = useRoute()
  const { locale } = useI18n()
  const { getLocalizedSetting } = useLocalizedSettings()
  const localePath = useLocalePath()

  useJsonLd(key, computed(() => {
    const item = toValue(post)
    if (!item?.title) return null
    const slug = String(item.slug || route.params.slug || '')
    const path = localePath(`/blog/${slug}`)
    const title = String(item.title)
    return [
      {
        '@type': 'BlogPosting',
        '@id': `${path}#article`,
        headline: title,
        description: String(item.description || '').trim() || undefined,
        image: item.imageUrl || undefined,
        datePublished: item.createdAt || undefined,
        dateModified: item.updatedAt || item.createdAt || undefined,
        inLanguage: SEO_LOCALE_LANGUAGE[locale.value as keyof typeof SEO_LOCALE_LANGUAGE] || locale.value,
        mainEntityOfPage: path,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: getLocalizedSetting('site_name', 'APay'), item: localePath('/') },
          { '@type': 'ListItem', position: 2, name: title, item: path },
        ],
      },
    ]
  }))
}
