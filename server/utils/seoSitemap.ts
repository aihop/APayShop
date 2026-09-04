import { and, eq, ne, isNotNull } from 'drizzle-orm'
import { products, posts } from '../db/schema'
import { db } from '../db/runtime'
import { absoluteSeoUrl, escapeXml, localePathForSeo, normalizeIsoDate, type SeoRouteManifest } from '~~/shared/siteSeo'

interface SitemapEntry {
  path: string
  lastmod?: string
}

const uniqueEntries = (entries: SitemapEntry[]) => [...new Map(entries.map(entry => [entry.path, entry])).values()]

async function loadThemeDynamicSeoSource(source: string): Promise<SitemapEntry[]> {
  if (source === 'shoply-apps' || source === 'shoply-themes') {
    try {
      const { shoplyMarketplaceSeeds } = await import('../../app/themes/shoply/data/marketplace')
      if (source === 'shoply-apps') {
        return shoplyMarketplaceSeeds.filter((item: any) => item.kind === 'app').map((item: any) => ({ path: `/apps/${item.slug}` }))
      }
      return shoplyMarketplaceSeeds.filter((item: any) => item.kind === 'theme').map((item: any) => ({ path: `/theme/${item.slug}` }))
    } catch {
      return []
    }
  }

  if (source === 'hoxi-models') {
    try {
      const { hoxiModels } = await import('../../app/themes/hoxi/data/models')
      return hoxiModels.map((model: any) => ({
        path: `/models/${model.slug}`,
        lastmod: normalizeIsoDate(model.updatedAt),
      }))
    } catch {
      return []
    }
  }

  return []
}

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
      .where(and(
        eq(products.status, 'active'),
        eq(products.isActive, true),
        isNotNull(products.slug)
      ))
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
    dynamicEntries.push(...await loadThemeDynamicSeoSource('shoply-apps'))
  }
  if (sources.has('shoply-themes')) {
    dynamicEntries.push(...await loadThemeDynamicSeoSource('shoply-themes'))
  }
  if (sources.has('hoxi-models')) {
    dynamicEntries.push(...await loadThemeDynamicSeoSource('hoxi-models'))
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
