#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const themeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { shoplyAppSeeds, shoplyThemeSeeds } = await import(pathToFileURL(path.join(themeRoot, 'data/marketplace.ts')))
const { shoplyMarketplaceLocales } = await import(pathToFileURL(path.join(themeRoot, 'locales/marketplace.ts')))

assert.equal(shoplyAppSeeds.length, 15, 'legacy public app catalog must include 15 entries')
assert.equal(shoplyThemeSeeds.length, 15, 'legacy public theme catalog must include 15 entries')
assert.ok(shoplyAppSeeds.some(entry => entry.slug === 'paddle'), 'Paddle application must exist')
assert.ok(shoplyThemeSeeds.some(entry => entry.slug === 'outdoor-equipment-mall'), 'legacy theme slug must exist')
assert.equal(new Set(shoplyAppSeeds.map(entry => entry.slug)).size, shoplyAppSeeds.length, 'app slugs must be unique')
assert.equal(new Set(shoplyThemeSeeds.map(entry => entry.slug)).size, shoplyThemeSeeds.length, 'theme slugs must be unique')

for (const code of ['en', 'zh', 'zh-HK', 'id', 'ru']) {
  const messages = shoplyMarketplaceLocales[code]
  assert.ok(messages.apps.title, `${code} app marketplace title is required`)
  assert.ok(messages.themes.title, `${code} theme marketplace title is required`)
  assert.equal(messages.detail.paddle.length, 3, `${code} Paddle detail must have three sections`)
}

const marketplaceComposable = readFileSync(path.join(themeRoot, 'composables/useShoplyMarketplace.ts'), 'utf8')
const detail = readFileSync(path.join(themeRoot, 'components/MarketplaceDetail.vue'), 'utf8')
const list = readFileSync(path.join(themeRoot, 'components/MarketplaceList.vue'), 'utf8')
const appIndex = readFileSync(path.join(themeRoot, 'pages/apps/index.vue'), 'utf8')
const appDetail = readFileSync(path.join(themeRoot, 'pages/apps/[slug].vue'), 'utf8')
const themeIndex = readFileSync(path.join(themeRoot, 'pages/theme/index.vue'), 'utf8')
const themeDetail = readFileSync(path.join(themeRoot, 'pages/theme/[slug].vue'), 'utf8')

assert.ok(marketplaceComposable.includes("shoply_catalog_type"), 'APay product metadata discriminator is required')
assert.ok(marketplaceComposable.includes("marketplace_slug"), 'APay product metadata marketplace slug is required')
assert.ok(marketplaceComposable.includes("translations"), 'localized APay product metadata is required')
assert.ok(marketplaceComposable.includes('server: false'), 'seed catalog SSR must not depend on the product API')
assert.ok(marketplaceComposable.includes('lazy: true'), 'APay product overrides must load as a non-blocking enhancement')
assert.ok(detail.includes('shoply://app/'), 'public install instructions must preserve the Shoply protocol command')
assert.ok(detail.includes("entry.kind === 'app' ? 'apps' : 'theme'"), 'detail back link must use the public plural apps route')
assert.ok(list.includes("kind === 'app' ? 'apps' : 'theme'"), 'catalog cards must use the public plural apps route')
assert.ok(!detail.includes('/api/package'), 'public detail must not expose the legacy package endpoint')
assert.ok(!detail.includes('downs +'), 'public detail must not mutate legacy download counters')
assert.ok(appDetail.includes("findEntry('app'"), 'app detail must be data driven')
assert.ok(themeDetail.includes("findEntry('theme'"), 'theme detail must be data driven')
for (const [name, source] of [['apps index', appIndex], ['apps detail', appDetail], ['theme index', themeIndex], ['theme detail', themeDetail]]) {
  assert.ok(source.includes("from '../../composables/useShoplyMarketplace'"), `${name} must explicitly import the theme composable`)
  assert.ok(!source.includes('await useShoplyMarketplace()'), `${name} must render without waiting for product overrides`)
}

console.log('✓ Shoply Apps and Theme marketplace contract passed (15 apps, 15 themes, 5 locales)')
