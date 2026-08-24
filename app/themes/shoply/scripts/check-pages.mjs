#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const themeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pageNames = ['about', 'amazon-store', 'b2b-website', 'b2c-store', 'case', 'cookies', 'custom', 'install', 'migration', 'pricing', 'privacy', 'terms', 'weidian']

for (const pageName of pageNames) {
  assert.ok(existsSync(path.join(themeRoot, 'pages/page', `${pageName}.vue`)), `missing /page/${pageName} Vue route`)
}

const sourceFiles = [
  'components/MarketingPage.vue',
  'components/LegalPage.vue',
  'components/PageCta.vue',
  'pages/page/pricing.vue',
  'locales/en.ts',
  'locales/zh.ts',
  'locales/zh-HK.ts',
  'locales/id.ts',
  'locales/ru.ts',
]
const source = sourceFiles.map(file => readFileSync(path.join(themeRoot, file), 'utf8')).join('\n')

for (const pageName of pageNames) assert.ok(source.includes(pageName) || ['pricing', 'cookies', 'privacy', 'terms'].includes(pageName), `missing page data: ${pageName}`)
for (const legacyMarker of ['/res/bluex', 'x-data=', 'FT::']) assert.ok(!source.includes(legacyMarker), `legacy marker must not be used: ${legacyMarker}`)

const pricing = readFileSync(path.join(themeRoot, 'pages/page/pricing.vue'), 'utf8')
for (const requirement of ["product.type !== 'subscription'", 'meta.is_pricing_plan !== true', "'/api/products'", 'formatAmount', 'subscription_cycle', 'localePath(`/products/${plan.slug}`)']) {
  assert.ok(pricing.includes(requirement), `pricing page missing APay integration: ${requirement}`)
}
assert.ok(!/\bany\b/.test(pricing), 'pricing page must not use any')

console.log(`✓ Shoply /page migration contract passed (${pageNames.length} routes)`)
