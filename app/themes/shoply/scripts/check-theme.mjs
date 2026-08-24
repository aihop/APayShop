#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const themeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const requiredFiles = [
  'AGENTS.md',
  'theme.json',
  'layouts/default.vue',
  'pages/index.vue',
  'components/SectionHeading.vue',
  'components/MarketplaceList.vue',
  'components/MarketplaceDetail.vue',
  'composables/useShoplyMarketplace.ts',
  'data/marketplace.ts',
  'locales/marketplace.ts',
  'pages/apps/index.vue',
  'pages/apps/[slug].vue',
  'pages/theme/index.vue',
  'pages/theme/[slug].vue',
  'locales/en.ts',
  'locales/zh.ts',
  'locales/zh-HK.ts',
  'locales/id.ts',
  'locales/ru.ts',
  'assets/logo.svg',
  'assets/logo-inverse.svg',
  'assets/ai-mark.svg',
  'assets/ribbons.svg',
]

for (const file of requiredFiles) {
  assert.ok(existsSync(path.join(themeRoot, file)), `missing required theme file: ${file}`)
}

const manifest = JSON.parse(readFileSync(path.join(themeRoot, 'theme.json'), 'utf8'))
assert.equal(manifest.version, '1.0.0')
assert.deepEqual(
  manifest.settings.map(setting => setting.key),
  ['shoply_signup_url', 'shoply_signin_url', 'shoply_consult_url', 'shoply_open_platform_url'],
)

const layout = readFileSync(path.join(themeRoot, 'layouts/default.vue'), 'utf8')
const homepage = readFileSync(path.join(themeRoot, 'pages/index.vue'), 'utf8')
const en = readFileSync(path.join(themeRoot, 'locales/en.ts'), 'utf8')
const zh = readFileSync(path.join(themeRoot, 'locales/zh.ts'), 'utf8')
const zhHK = readFileSync(path.join(themeRoot, 'locales/zh-HK.ts'), 'utf8')
const id = readFileSync(path.join(themeRoot, 'locales/id.ts'), 'utf8')
const ru = readFileSync(path.join(themeRoot, 'locales/ru.ts'), 'utf8')
const themeSource = `${layout}\n${homepage}\n${en}\n${zh}\n${zhHK}\n${id}\n${ru}`
const marketplaceSource = [
  'components/MarketplaceList.vue',
  'components/MarketplaceDetail.vue',
  'composables/useShoplyMarketplace.ts',
  'data/marketplace.ts',
  'locales/marketplace.ts',
  'pages/apps/index.vue',
  'pages/apps/[slug].vue',
  'pages/theme/index.vue',
  'pages/theme/[slug].vue',
].map(file => readFileSync(path.join(themeRoot, file), 'utf8')).join('\n')

for (const section of ['solutions', 'ai', 'platform', 'deployment']) {
  assert.ok(themeSource.includes(section), `missing homepage section: ${section}`)
}

for (const key of ['shoply.nav.', 'shoply.hero.', 'shoply.values.', 'shoply.audiences.', 'shoply.ai.', 'shoply.platform.', 'shoply.deployment.', 'shoply.cta.']) {
  assert.ok(themeSource.includes(key), `missing translation namespace use: ${key}`)
}

assert.ok(layout.includes('mergeLocaleMessage(\'en\', { shoply: en })'))
assert.ok(layout.includes('mergeLocaleMessage(\'zh\', { shoply: zh })'))
assert.ok(layout.includes('mergeLocaleMessage(\'zh-HK\', { shoply: zhHK })'))
assert.ok(layout.includes('mergeLocaleMessage(\'id\', { shoply: id })'))
assert.ok(layout.includes('mergeLocaleMessage(\'ru\', { shoply: ru })'))
assert.ok(homepage.includes('useSeoMeta'))
assert.ok(layout.includes('isMobileMenuOpen'))
assert.ok(layout.includes('shoply_signup_url'))
assert.ok(layout.includes('shoply_signin_url'))
assert.ok(homepage.includes('shoply_consult_url'))
assert.ok(!themeSource.includes('/res/bluex'), 'legacy bluex asset path must not be used')
assert.ok(!themeSource.includes('x-data='), 'legacy Alpine runtime must not be used')
assert.ok(!themeSource.includes('FT::'), 'legacy Jet template markers must not be used')
assert.ok(!marketplaceSource.includes('x-data='), 'marketplace must not use legacy Alpine runtime')
assert.ok(!marketplaceSource.includes('FT::'), 'marketplace must not use legacy Jet template markers')

console.log('✓ Shoply theme static contract passed')
