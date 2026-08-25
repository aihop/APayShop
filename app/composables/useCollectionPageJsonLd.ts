import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { SEO_LOCALE_LANGUAGE } from '~~/shared/siteSeo'
import { useJsonLd, type JsonLdNode } from './useJsonLd'

export interface CollectionPageItem {
  name?: unknown
  title?: unknown
  slug?: unknown
  url?: unknown
  image?: unknown
  imageUrl?: unknown
  description?: unknown
  summary?: unknown
}

export interface CollectionPageJsonLdOptions {
  path: string
  name: MaybeRefOrGetter<unknown>
  description?: MaybeRefOrGetter<unknown>
  items: MaybeRefOrGetter<CollectionPageItem[] | null | undefined>
  itemPath?: string
}

const text = (value: unknown) => String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

export const useCollectionPageJsonLd = (key: string, options: CollectionPageJsonLdOptions) => {
  const { locale } = useI18n()
  const localePath = useLocalePath()

  useJsonLd(key, computed<JsonLdNode[]>(() => {
    const collectionPath = localePath(options.path)
    const collectionName = text(toValue(options.name))
    if (!collectionName || !collectionPath) return []

    const itemPath = options.itemPath || options.path
    const items = (toValue(options.items) || []).flatMap((item, index) => {
      const name = text(item.name ?? item.title)
      const rawUrl = text(item.url)
      const slug = text(item.slug)
      const itemUrl = rawUrl || (slug ? localePath(`${itemPath}/${slug}`) : '')
      if (!name || !itemUrl) return []
      const listItem: Record<string, unknown> = {
        '@type': 'ListItem',
        position: index + 1,
        name,
        item: itemUrl,
      }
      return [listItem]
    })

    const itemListId = `${collectionPath}#item-list`
    return [
      {
        '@type': 'CollectionPage',
        '@id': `${collectionPath}#collection`,
        url: collectionPath,
        name: collectionName,
        description: text(toValue(options.description)) || undefined,
        inLanguage: SEO_LOCALE_LANGUAGE[locale.value as keyof typeof SEO_LOCALE_LANGUAGE] || locale.value,
        mainEntity: { '@id': itemListId },
      },
      {
        '@type': 'ItemList',
        '@id': itemListId,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: items.length,
        itemListElement: items,
      },
    ]
  }))
}
