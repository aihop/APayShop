import { computed } from 'vue'
import { publishedOptionalThemeSet } from '~/generated/theme-build'
import { shoplyMarketplaceSeeds } from '../data/marketplace'
import { shoplyMarketplaceLocales, type ShoplyMarketplaceLocale } from '../locales/marketplace'
import type { ShoplyAppCategory, ShoplyAppRuntimeKind, ShoplyMarketplaceEntry, ShoplyMarketplaceKind, ShoplyPackageKind, ShoplyPackageStatus, ShoplyThemeCategory } from '../types/marketplace'

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
  package_kind?: ShoplyPackageKind
  artifact_id?: string
  runtime_kind?: ShoplyAppRuntimeKind
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

const appCategories = new Set<ShoplyAppCategory>(['payment', 'localization', 'data', 'communication', 'commerce', 'identity', 'utility'])
const themeCategories = new Set<ShoplyThemeCategory>(['business', 'outdoor', 'electronics', 'fashion', 'beauty', 'home', 'pets', 'sports', 'jewelry', 'medical', 'kids'])

const normalizeCategory = (kind: ShoplyMarketplaceKind, category?: string) => {
  if (kind === 'app') return appCategories.has(category as ShoplyAppCategory) ? category as ShoplyAppCategory : 'utility'
  return themeCategories.has(category as ShoplyThemeCategory) ? category as ShoplyThemeCategory : 'fashion'
}

export const useShoplyMarketplace = () => {
  const { locale } = useI18n()
  const { getSetting } = useSettings()
  const { installedExtensions, enabledExtensions } = useExtensions()
  const localeCode = computed<ShoplyMarketplaceLocale>(() => locale.value in shoplyMarketplaceLocales ? locale.value as ShoplyMarketplaceLocale : 'en')
  const copy = computed(() => shoplyMarketplaceLocales[localeCode.value])
  const { data: productsData, status, error } = useFetch<ProductsResponse>('/api/products', {
    key: 'shoply-marketplace-products',
    server: false,
    lazy: true,
    query: { pageSize: 200 },
  })

  const installedExtensionIds = computed(() => new Set(installedExtensions.value.map(extension => extension.id)))
  const enabledExtensionIds = computed(() => new Set(enabledExtensions.value.map(extension => extension.id)))

  const packageState = (packageKind: ShoplyPackageKind, artifactId?: string): {
    packageStatus: ShoplyPackageStatus
    managementPath: string | null
  } => {
    if (!artifactId) return { packageStatus: 'not_built', managementPath: null }
    if (packageKind === 'extension') {
      if (!installedExtensionIds.value.has(artifactId)) return { packageStatus: 'not_built', managementPath: null }
      return {
        packageStatus: enabledExtensionIds.value.has(artifactId) ? 'enabled' : 'ready',
        managementPath: '/admin/settings/extensions',
      }
    }
    if (!publishedOptionalThemeSet.has(artifactId)) return { packageStatus: 'not_built', managementPath: null }
    return {
      packageStatus: getSetting('active_theme') === artifactId ? 'active' : 'ready',
      managementPath: '/admin/settings/themes',
    }
  }

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
      const packageKind = override?.meta.package_kind || seed.packageKind
      const artifactId = override?.meta.artifact_id || seed.artifactId
      return {
        ...seed,
        packageKind,
        artifactId,
        runtimeKind: override?.meta.runtime_kind || seed.runtimeKind,
        name: translation?.name || override?.product.name || seed.name,
        summary,
        contentTitle: translation?.content_title || (seed.kind === 'app' ? copy.value.detail.appTitle : copy.value.detail.themeTitle),
        sections,
        accent: override?.meta.accent || seed.accent,
        mark: override?.meta.mark || seed.mark,
        category: normalizeCategory(seed.kind, override?.meta.category || seed.category),
        version: override?.meta.version || seed.version,
        demoUrl: override?.meta.demo_url || seed.demoUrl,
        price: override ? Number(override.product.price || 0) : 0,
        productSlug: override?.product.slug || null,
        imageUrl: override?.product.imageUrl || null,
        ...packageState(packageKind, artifactId),
      }
    })

    const additional = [...productByKey.values()].map(({ product, meta }): ShoplyMarketplaceEntry => {
      const kind = meta.shoply_catalog_type || 'app'
      const packageKind = meta.package_kind || (kind === 'app' ? 'extension' : 'theme')
      const translation = meta.translations?.[localeCode.value]
      return {
        kind,
        packageKind,
        artifactId: meta.artifact_id,
        runtimeKind: meta.runtime_kind,
        slug: meta.marketplace_slug || product.slug || '',
        name: translation?.name || product.name,
        summary: translation?.description || product.description || (kind === 'app' ? copy.value.detail.appGeneric : copy.value.detail.themeGeneric),
        contentTitle: translation?.content_title || (kind === 'app' ? copy.value.detail.appTitle : copy.value.detail.themeTitle),
        sections: translation?.sections?.flatMap(section => section.title && section.paragraphs?.length ? [{ title: section.title, paragraphs: section.paragraphs }] : []) || [],
        category: normalizeCategory(kind, meta.category),
        mark: meta.mark || product.name.slice(0, 2).toUpperCase(),
        accent: meta.accent || '#2563eb',
        version: meta.version,
        demoUrl: meta.demo_url,
        price: Number(product.price || 0),
        productSlug: product.slug,
        imageUrl: product.imageUrl,
        ...packageState(packageKind, meta.artifact_id),
      }
    })

    return [...seeded, ...additional]
  })

  const apps = computed(() => entries.value.filter(entry => entry.kind === 'app'))
  const themes = computed(() => entries.value.filter(entry => entry.kind === 'theme'))
  const findEntry = (kind: ShoplyMarketplaceKind, slug: string) => entries.value.find(entry => entry.kind === kind && entry.slug === slug) || null

  return { apps, themes, entries, findEntry, copy, localeCode, status, error }
}
