import { computed } from 'vue'
import { shoplyMarketplaceSeeds } from '../data/marketplace'
import { shoplyMarketplaceLocales, type ShoplyMarketplaceLocale } from '../locales/marketplace'
import type { ShoplyMarketplaceEntry, ShoplyMarketplaceKind } from '../types/marketplace'

interface ProductRecord {
  slug: string | null
  name: string
  description: string | null
  content: string | null
  price: number
  imageUrl: string | null
  metaData: unknown
}

interface ProductsResponse {
  data: ProductRecord[]
}

interface CatalogMeta {
  shoply_catalog_type?: ShoplyMarketplaceKind
  marketplace_slug?: string
  category?: string
  accent?: string
  mark?: string
  demo_url?: string
  version?: string
  translations?: Record<string, {
    name?: string
    description?: string
    content_title?: string
    sections?: Array<{ title?: string, paragraphs?: string[] }>
  }>
}

const parseMeta = (value: unknown): CatalogMeta => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as CatalogMeta
  if (typeof value !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as CatalogMeta : {}
  } catch {
    return {}
  }
}

export const useShoplyMarketplace = () => {
  const { locale } = useI18n()
  const localeCode = computed<ShoplyMarketplaceLocale>(() => locale.value in shoplyMarketplaceLocales ? locale.value as ShoplyMarketplaceLocale : 'en')
  const copy = computed(() => shoplyMarketplaceLocales[localeCode.value])
  const { data: productsData, status, error } = useFetch<ProductsResponse>('/api/products', {
    key: 'shoply-marketplace-products',
    server: false,
    lazy: true,
    query: { pageSize: 200 },
  })

  const entries = computed<ShoplyMarketplaceEntry[]>(() => {
    const products = productsData.value?.data || []
    const productByKey = new Map<string, { product: ProductRecord, meta: CatalogMeta }>()
    for (const product of products) {
      const meta = parseMeta(product.metaData)
      if (!meta.shoply_catalog_type || !product.slug) continue
      productByKey.set(`${meta.shoply_catalog_type}:${meta.marketplace_slug || product.slug}`, { product, meta })
    }

    const seeded = shoplyMarketplaceSeeds.map((seed): ShoplyMarketplaceEntry => {
      const override = productByKey.get(`${seed.kind}:${seed.slug}`)
      const translation = override?.meta.translations?.[localeCode.value]
      const categoryCopy = seed.kind === 'app'
        ? copy.value.appCategories[seed.category as keyof typeof copy.value.appCategories]
        : null
      const summary = translation?.description || (seed.kind === 'app'
        ? categoryCopy?.[1] || copy.value.detail.appGeneric
        : copy.value.detail.themeGeneric)
      const sections = translation?.sections?.flatMap(section => section.title && section.paragraphs?.length
        ? [{ title: section.title, paragraphs: section.paragraphs }]
        : []) || (seed.slug === 'paddle'
          ? copy.value.detail.paddle.map(section => ({ title: section.title, paragraphs: [...section.paragraphs] }))
          : [{ title: seed.kind === 'app' ? copy.value.detail.appTitle : copy.value.detail.themeTitle, paragraphs: [seed.kind === 'app' ? copy.value.detail.appGeneric : copy.value.detail.themeGeneric] }])
      productByKey.delete(`${seed.kind}:${seed.slug}`)
      return {
        ...seed,
        name: translation?.name || override?.product.name || seed.name,
        summary,
        contentTitle: translation?.content_title || (seed.kind === 'app' ? copy.value.detail.appTitle : copy.value.detail.themeTitle),
        sections,
        accent: override?.meta.accent || seed.accent,
        mark: override?.meta.mark || seed.mark,
        category: override?.meta.category || seed.category,
        version: override?.meta.version || seed.version,
        demoUrl: override?.meta.demo_url || seed.demoUrl,
        price: override ? Number(override.product.price || 0) : 0,
        productSlug: override?.product.slug || null,
        imageUrl: override?.product.imageUrl || null,
      }
    })

    const additional = [...productByKey.values()].map(({ product, meta }): ShoplyMarketplaceEntry => {
      const kind = meta.shoply_catalog_type || 'app'
      const translation = meta.translations?.[localeCode.value]
      return {
        kind,
        slug: meta.marketplace_slug || product.slug || '',
        name: translation?.name || product.name,
        summary: translation?.description || product.description || (kind === 'app' ? copy.value.detail.appGeneric : copy.value.detail.themeGeneric),
        contentTitle: translation?.content_title || (kind === 'app' ? copy.value.detail.appTitle : copy.value.detail.themeTitle),
        sections: translation?.sections?.flatMap(section => section.title && section.paragraphs?.length ? [{ title: section.title, paragraphs: section.paragraphs }] : []) || [],
        category: meta.category || (kind === 'app' ? 'utility' : 'fashion'),
        mark: meta.mark || product.name.slice(0, 2).toUpperCase(),
        accent: meta.accent || '#2563eb',
        version: meta.version,
        demoUrl: meta.demo_url,
        price: Number(product.price || 0),
        productSlug: product.slug,
        imageUrl: product.imageUrl,
      }
    })

    return [...seeded, ...additional]
  })

  const apps = computed(() => entries.value.filter(entry => entry.kind === 'app'))
  const themes = computed(() => entries.value.filter(entry => entry.kind === 'theme'))
  const findEntry = (kind: ShoplyMarketplaceKind, slug: string) => entries.value.find(entry => entry.kind === kind && entry.slug === slug) || null

  return { apps, themes, entries, findEntry, copy, localeCode, status, error }
}
