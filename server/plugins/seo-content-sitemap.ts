import { queryCollection } from '@nuxt/content/server'
import { getRequestURL } from 'h3'
import { seoRouteRegistry } from '~~/shared/generated/seo-routes'
import { absoluteSeoUrl, escapeXml, localePathForSeo } from '~~/shared/siteSeo'
import { resolveServerSeoContext } from '../utils/siteSeo'

const urlBlocks = (xml: string) => xml.match(/  <url>[\s\S]*?<\/url>/g) || []

const contentUrlBlocks = (
  englishPaths: Set<string>,
  chinesePaths: Set<string>,
  origin: string,
  locales: Array<{ code: string, language: string }>,
  defaultLocale: string,
) => [...new Set([...englishPaths, ...chinesePaths])].flatMap((path) => {
  const available = locales.filter(locale => locale.code === 'zh' ? chinesePaths.has(path) : englishPaths.has(path))
  return available.map((locale) => {
    const alternateLinks = available.map((alternate) => {
      const href = absoluteSeoUrl(origin, localePathForSeo(path, alternate.code, defaultLocale))
      return `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.language)}" href="${escapeXml(href)}" />`
    })
    const defaultAlternate = available.find(locale => locale.code === defaultLocale)
      || available.find(locale => locale.code === 'en')
      || available[0]
    if (defaultAlternate) {
      const href = absoluteSeoUrl(origin, localePathForSeo(path, defaultAlternate.code, defaultLocale))
      alternateLinks.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(href)}" />`)
    }
    const location = absoluteSeoUrl(origin, localePathForSeo(path, locale.code, defaultLocale))
    return [
      '  <url>',
      `    <loc>${escapeXml(location)}</loc>`,
      ...alternateLinks,
      '  </url>',
    ].join('\n')
  })
})

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', async (event, response) => {
    if (getRequestURL(event).pathname !== '/sitemap.xml' || typeof response.body !== 'string') return

    try {
      const { theme, origin, locales, defaultLocale } = await resolveServerSeoContext(event)
      const manifest = seoRouteRegistry.themes[theme]
      if (!origin || !manifest?.dynamic.some(route => route.pattern === '/docs/**')) return

      const [english, chinese] = await Promise.all([
        queryCollection(event, 'docs_en').select('path').all(),
        queryCollection(event, 'docs_zh').select('path').all(),
      ])
      const englishPaths = new Set(english.map(item => String(item.path || '')).filter(path => path.startsWith('/docs/') && path !== '/docs'))
      const chinesePaths = new Set(chinese.map(item => String(item.path || '')).filter(path => path.startsWith('/docs/') && path !== '/docs'))
      const docsBlocks = contentUrlBlocks(englishPaths, chinesePaths, origin, locales, defaultLocale)
      if (!docsBlocks.length) return

      const existing = new Set(urlBlocks(response.body).map(block => block.match(/<loc>([^<]+)<\/loc>/)?.[1]).filter(Boolean))
      const additions = docsBlocks.filter(block => {
        const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]
        return Boolean(loc && !existing.has(loc))
      })
      if (existing.size + additions.length > 50000) throw new Error('Sitemap exceeds the 50,000 URL limit after adding content documents')
      if (additions.length) response.body = response.body.replace('</urlset>', `${additions.join('\n')}\n</urlset>`)
    } catch (error) {
      console.error('Failed to append content documents to sitemap:', error)
    }
  })
})
