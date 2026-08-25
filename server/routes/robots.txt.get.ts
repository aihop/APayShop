import { resolveServerSeoContext } from '../utils/siteSeo'

export default defineEventHandler(async (event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=300, stale-while-revalidate=3600')
  const { origin, locales } = await resolveServerSeoContext(event)
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
  ]
  for (const locale of locales) {
    lines.push(`Disallow: /${locale.code}/api/`)
  }
  if (origin) lines.push(`Sitemap: ${origin}/sitemap.xml`)
  return `${lines.join('\n')}\n`
})
