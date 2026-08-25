import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const mustInclude = (source, markers, label) => {
  for (const marker of markers) assert.ok(source.includes(marker), `${label} must include ${marker}`)
}

const collection = read('app/composables/useCollectionPageJsonLd.ts')
mustInclude(collection, ["'CollectionPage'", "'ItemList'", 'itemListElement: items', 'numberOfItems: items.length', 'SEO_LOCALE_LANGUAGE'], 'collection JSON-LD composable')

const social = read('app/plugins/seo-social.ts')
mustInclude(social, ['tags:afterResolve', "'twitter:card'", "'twitter:title'", "'twitter:description'", "'twitter:image'", "'summary_large_image'", "'CollectionPage'", "'ItemList'", "'WebPage'", "'noindex,follow'", 'route.query.page'], 'social SEO plugin')

const contentSitemap = read('server/plugins/seo-content-sitemap.ts')
mustInclude(contentSitemap, ["queryCollection(event, 'docs_en')", "queryCollection(event, 'docs_zh')", "route.pattern === '/docs/**'", 'localePathForSeo', '50000'], 'content sitemap plugin')

const listPages = [
  ['app/core/pages/products/index.vue', 'core-products-list'],
  ['app/themes/ainode/pages/products/index.vue', 'ainode-products-list'],
  ['app/themes/ainode/pages/blog/index.vue', 'ainode-blog-list'],
  ['app/themes/design/pages/products/index.vue', 'design-products-list'],
  ['app/themes/official/pages/products/index.vue', 'official-products-list'],
  ['app/themes/official/pages/blog/index.vue', 'official-blog-list'],
  ['app/themes/panel/pages/products/index.vue', 'panel-products-list'],
  ['app/themes/qingpu/pages/products/index.vue', 'qingpu-products-list'],
  ['app/themes/qingpu/pages/blog/index.vue', 'qingpu-blog-list'],
  ['app/themes/shoply/pages/apps/index.vue', 'shoply-apps-list'],
  ['app/themes/shoply/pages/theme/index.vue', 'shoply-themes-list'],
]
for (const [path, key] of listPages) {
  const source = read(path)
  assert.ok(source.includes(`useCollectionPageJsonLd('${key}'`), `${path} must register ${key}`)
}

for (const path of ['app/themes/ainode/pages/blog/index.vue', 'app/themes/official/pages/blog/index.vue', 'app/themes/official/pages/products/index.vue']) {
  const source = read(path)
  assert.ok(!source.includes('<ClientOnly>'), `${path} list content must participate in SSR`)
  assert.ok(!source.includes('lazy: true'), `${path} list data must participate in SSR`)
}

console.log('SEO follow-up checks passed')
