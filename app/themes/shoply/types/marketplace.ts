export type ShoplyMarketplaceKind = 'app' | 'theme'
export type ShoplyPackageKind = 'extension' | 'theme'
export type ShoplyAppRuntimeKind = 'ui' | 'payment' | 'auth' | 'messaging' | 'importer'
export type ShoplyPackageStatus = 'not_built' | 'ready' | 'enabled' | 'active'

export type ShoplyAppCategory = 'payment' | 'localization' | 'data' | 'communication' | 'commerce' | 'identity' | 'utility'
export type ShoplyThemeCategory = 'business' | 'outdoor' | 'electronics' | 'fashion' | 'beauty' | 'home' | 'pets' | 'sports' | 'jewelry' | 'medical' | 'kids'

export interface ShoplyMarketplaceSeed {
  kind: ShoplyMarketplaceKind
  packageKind: ShoplyPackageKind
  slug: string
  name: string
  category: ShoplyAppCategory | ShoplyThemeCategory
  artifactId?: string
  runtimeKind?: ShoplyAppRuntimeKind
  mark: string
  accent: string
  publishedAt?: string
  downloads?: number
  version?: string
  demoUrl?: string
}

export interface ShoplyMarketplaceEntry extends ShoplyMarketplaceSeed {
  summary: string
  contentTitle: string
  sections: Array<{
    title: string
    paragraphs: string[]
  }>
  price: number | null
  productSlug: string | null
  imageUrl: string | null
  packageStatus: ShoplyPackageStatus
  managementPath: string | null
}
