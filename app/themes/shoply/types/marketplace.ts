export type ShoplyMarketplaceKind = 'app' | 'theme'

export type ShoplyAppCategory = 'payment' | 'localization' | 'data' | 'communication' | 'commerce' | 'identity' | 'utility'
export type ShoplyThemeCategory = 'outdoor' | 'electronics' | 'fashion' | 'beauty' | 'home' | 'pets' | 'sports' | 'jewelry' | 'medical' | 'kids'

export interface ShoplyMarketplaceSeed {
  kind: ShoplyMarketplaceKind
  slug: string
  name: string
  category: ShoplyAppCategory | ShoplyThemeCategory
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
}
