import { seoRouteRegistry } from '~~/shared/generated/seo-routes'
import { classifySeoRoute } from '~~/shared/siteSeo'
import { resolveServerSeoContext } from '../utils/siteSeo'
import { collectSitemapEntries, renderSitemapXml } from '../utils/seoSitemap'

export default defineEventHandler(async (event) => {
  try {
    const { origin, theme, locales, defaultLocale } = await resolveServerSeoContext(event)
    if (!origin) throw new Error('settings.site_url must be a valid absolute HTTP(S) origin')
    const entries = (await collectSitemapEntries(seoRouteRegistry.core, seoRouteRegistry.themes[theme]))
      .filter(entry => classifySeoRoute(seoRouteRegistry, theme, entry.path).kind === 'public')
    const xml = renderSitemapXml(entries, origin, locales, defaultLocale)
    setHeader(event, 'content-type', 'application/xml; charset=utf-8')
    setHeader(event, 'cache-control', 'public, max-age=300, stale-while-revalidate=3600')
    return xml
  } catch (error) {
    console.error('Failed to generate sitemap:', error)
    throw createError({ statusCode: 503, statusMessage: 'Sitemap unavailable' })
  }
})
