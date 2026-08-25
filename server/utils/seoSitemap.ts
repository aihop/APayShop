import { and, eq, isNotNull } from 'drizzle-orm'
import { products, posts } from '../db/schema'
import { db } from '../db/runtime'
import { shoplyMarketplaceSeeds } from '../../app/themes/shoply/data/marketplace'
import { absoluteSeoUrl, escapeXml, localePathForSeo, type SeoRouteManifest } from '~~/shared/siteSeo'

interface SitemapEntry {
  path: string
  lastmod?: string
}

const uniqueEntries = (entries: SitemapEntry[]) => [...new Map(entries.map(entry => [entry.path, entry])).values()]

export async function collectSitemapEntries(core: SeoRouteManifest, theme?: SeoRouteManifest): Promise<SitemapEntry[]> {
  const suppress = new Set(theme?.suppressCore || [])
  const staticEntries = [
    ...core.public.filter(path => !suppress.has(path)),
    ...(theme?.public || []),
  ].map(path => ({ path }))
  const sources = new Set([
    ...core.dynamic.map(route => route.source).filter(Boolean),
    ...(theme?.dynamic || []).map(route => route.source).filter(Boolean),
  ])
  const dynamicEntries: SitemapEntry[] = []

  if (sources.has('products')) {
    const rows = await db.select({ slug: products.slug, createdAt: products.createdAt })
      .from(products)
      .where(and(eq(products.isActive, true), isNotNull(products.slug)))
    dynamicEntries.push(...rows.flatMap((row: { slug: string | null, createdAt: Date }) => row.slug ? [{ path: `/products/${row.slug}`, lastmod: row.createdAt?.toISOString?.() }] : []))
  }
  if (sources.has('posts')) {
    const rows = await db.select({ slug: posts.slug, createdAt: posts.createdAt, updatedAt: posts.updatedAt })
      .from(posts)
      .where(and(eq(posts.isActive, true), eq(posts.type, 'blog')))
    dynamicEntries.push(...rows.map((row: { slug: string, createdAt: Date, updatedAt: Date | null }) => ({
      path: `/blog/${row.slug}`,
      lastmod: (row.updatedAt || row.createdAt)?.toISOString?.(),
    })))
  }
  if (sources.has('shoply-apps')) {
    dynamicEntries.push(...shoplyMarketplaceSeeds.filter(item => item.kind === 'app').map(item => ({ path: `/apps/${item.slug}` })))
  }
  if (sources.has('shoply-themes')) {
    dynamicEntries.push(...shoplyMarketplaceSeeds.filter(item => item.kind === 'theme').map(item => ({ path: `/theme/${item.slug}` })))
  }

  return uniqueEntries([...staticEntries, ...dynamicEntries])
}

export function renderSitemapXml(
  entries: SitemapEntry[],
  origin: string,
  locales: Array<{ code: string, language: string }>,
  defaultLocale: string,
): string {
  const urls = entries.flatMap(entry => locales.map(locale => {
    const path = localePathForSeo(entry.path, locale.code, defaultLocale)
    const alternates = locales.map(alternate => {
      const href = absoluteSeoUrl(origin, localePathForSeo(entry.path, alternate.code, defaultLocale))
      return `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.language)}" href="${escapeXml(href)}" />`
    })
    const defaultHref = absoluteSeoUrl(origin, localePathForSeo(entry.path, defaultLocale, defaultLocale))
    alternates.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(defaultHref)}" />`)
    return [
      '  <url>',
      `    <loc>${escapeXml(absoluteSeoUrl(origin, path))}</loc>`,
      ...(entry.lastmod ? [`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`] : []),
      ...alternates,
      '  </url>',
    ].join('\n')
  }))
  if (urls.length > 50000) throw new Error('Sitemap exceeds the 50,000 URL limit')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
