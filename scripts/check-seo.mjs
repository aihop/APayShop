import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  absoluteSeoUrl,
  classifySeoRoute,
  escapeXml,
  localePathForSeo,
  normalizeSiteOrigin,
  safeJsonLd,
  stripLocalePrefix,
} from '../shared/siteSeo.ts'

const root = process.cwd()
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const themeNames = ['aihop', 'ainode', 'design', 'minimal', 'nft', 'official', 'panel', 'qingpu', 'shoply']
const registry = {
  core: readJson('app/core/seo.routes.json'),
  themes: Object.fromEntries(themeNames.map(theme => [theme, readJson(`app/themes/${theme}/seo.routes.json`)])),
}

const pathFromPage = (file) => {
  const withoutExtension = file.replace(/\.vue$/, '')
  const withoutIndex = withoutExtension === 'index' ? '' : withoutExtension.replace(/\/index$/, '')
  return `/${withoutIndex}`
    .replace(/\/\[\.\.\.([^\]]+)\]/g, '/**')
    .replace(/\/\[([^\]]+)\]/g, '/:$1') || '/'
}

const listPageFiles = (base) => {
  const pagesDir = path.join(root, base, 'pages')
  const result = []
  const walk = (directory) => {
    for (const name of fs.readdirSync(directory)) {
      const fullPath = path.join(directory, name)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) walk(fullPath)
      else if (name.endsWith('.vue')) result.push(path.relative(pagesDir, fullPath).split(path.sep).join('/'))
    }
  }
  walk(pagesDir)
  return result.filter(file => !file.includes('/components/') && !file.endsWith('/layout.vue'))
}

const manifestPatterns = manifest => [
  ...manifest.public,
  ...manifest.dynamic.map(route => route.pattern),
  ...manifest.private,
  ...manifest.redirect,
]

const matchesPattern = (pathValue, patternValue) => {
  const pathParts = pathValue.split('/').filter(Boolean)
  const patternParts = patternValue.split('/').filter(Boolean)
  if (patternParts.at(-1) === '**') {
    const prefix = patternParts.slice(0, -1)
    return prefix.every((part, index) => part.startsWith(':') || pathParts[index] === part)
  }
  return pathParts.length === patternParts.length
    && patternParts.every((part, index) => part.startsWith(':') || pathParts[index] === part)
}

for (const [name, base] of [['core', 'app/core'], ...themeNames.map(theme => [theme, `app/themes/${theme}`])]) {
  const manifest = name === 'core' ? registry.core : registry.themes[name]
  const pagePatterns = listPageFiles(base).map(pathFromPage)
  const declared = manifestPatterns(manifest)
  assert.equal(new Set(declared).size, declared.length, `${name} SEO manifest contains duplicate route classifications`)
  for (const pattern of declared) {
    assert.ok(!pattern.startsWith('/admin') && !pattern.startsWith('/api'), `${name} must not declare ${pattern}`)
  }
  for (const pagePattern of pagePatterns) {
    const kinds = new Set([
      manifest.public.some(pattern => matchesPattern(pagePattern, pattern)) ? 'public' : '',
      manifest.dynamic.some(route => matchesPattern(pagePattern, route.pattern)) ? 'public' : '',
      manifest.private.some(pattern => matchesPattern(pagePattern, pattern)) ? 'private' : '',
      manifest.redirect.some(pattern => matchesPattern(pagePattern, pattern)) ? 'redirect' : '',
    ].filter(Boolean))
    assert.equal(kinds.size, 1, `${name} page ${pagePattern} must have exactly one SEO route kind`)
  }
  for (const pattern of declared) {
    assert.ok(pagePatterns.some(pagePattern => matchesPattern(pagePattern, pattern)), `${name} SEO route ${pattern} does not map to a page entry`)
  }
}

assert.deepEqual(classifySeoRoute(registry, 'official', '/products/demo'), { kind: 'public', source: 'products' })
assert.deepEqual(classifySeoRoute(registry, 'official', '/user/orders'), { kind: 'private' })
assert.deepEqual(classifySeoRoute(registry, 'shoply', '/theme/detail/demo'), { kind: 'redirect' })
assert.deepEqual(classifySeoRoute(registry, 'shoply', '/about'), { kind: 'unknown' })
assert.deepEqual(classifySeoRoute(registry, 'nft', '/products/demo'), { kind: 'private' })
assert.equal(stripLocalePrefix('/zh-HK/products/demo?ref=x', ['en', 'zh', 'zh-HK', 'id', 'ru']), '/products/demo')
assert.equal(localePathForSeo('/products/demo', 'en', 'en'), '/products/demo')
assert.equal(localePathForSeo('/products/demo', 'ru', 'en'), '/ru/products/demo')
assert.equal(normalizeSiteOrigin('https://apay.example/'), 'https://apay.example')
assert.equal(normalizeSiteOrigin('https://apay.example/store'), '')
assert.equal(normalizeSiteOrigin('javascript:alert(1)'), '')
assert.equal(absoluteSeoUrl('https://apay.example', '/zh/products/demo?ref=x'), 'https://apay.example/zh/products/demo')
assert.equal(escapeXml('<&"\'>'), '&lt;&amp;&quot;&apos;&gt;')
assert.equal(safeJsonLd({ value: '</script>\u2028' }).includes('</script>'), false)

const seoPlugin = read('app/plugins/i18n-seo.ts')
for (const token of ['Organization', 'WebSite', 'application/ld+json', 'rel: \'canonical\'', "hreflang: 'x-default'", 'ogUrl', 'noindex,follow']) {
  assert.ok(seoPlugin.includes(token), `i18n-seo.ts must include ${token}`)
}
assert.match(seoPlugin, /\['http:', 'https:'\]\.includes\(logoUrl\.protocol\)/)
assert.match(seoPlugin, /const homeUrl = absoluteUrl\('\/'\)/)
assert.match(seoPlugin, /const websiteUrl = absoluteUrl\(localePathForSeo/)
for (const forbidden of ['AggregateRating', 'reviewCount', 'SearchAction', 'sameAs']) {
  assert.ok(!seoPlugin.includes(forbidden), `i18n-seo.ts must not fabricate ${forbidden}`)
}

const sitemap = read('server/utils/seoSitemap.ts')
assert.match(sitemap, /eq\(products\.isActive, true\)/)
assert.match(sitemap, /eq\(posts\.isActive, true\)/)
assert.match(sitemap, /50000/)
assert.match(read('server/routes/sitemap.xml.get.ts'), /classifySeoRoute/)
assert.match(read('server/api/products/[slug].get.ts'), /eq\(products\.isActive, true\)/)
assert.doesNotMatch(read('app/themes/shoply/composables/useShoplyMarketplace.ts'), /server:\s*false/)
assert.match(read('app/themes/qingpu/pages/blog/[slug].vue'), /getLocalizedPost\(data\.value\)/)
assert.match(read('app/themes/design/pages/products/[slug].vue'), /formatAmount\(product\.price\)/)
assert.match(read('server/middleware/seo-headers.ts'), /X-Robots-Tag/)
assert.match(read('server/middleware/seo-headers.ts'), /stripLocalePrefix/)
assert.match(read('server/routes/robots.txt.get.ts'), /Sitemap:/)
assert.doesNotMatch(read('server/routes/robots.txt.get.ts'), /Disallow: \/user\//)

console.log('International SEO checks passed')
