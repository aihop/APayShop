#!/usr/bin/env node
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const themeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localeCodes = ['en', 'zh', 'zh-HK', 'id', 'ru']
const messages = Object.fromEntries(await Promise.all(localeCodes.map(async code => [
  code,
  (await import(pathToFileURL(path.join(themeRoot, 'locales', `${code}.ts`)))).default,
])))

const shape = (value) => {
  if (Array.isArray(value)) return value.map(shape)
  if (!value || typeof value !== 'object') return typeof value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child)]))
}

const expectedShape = shape(messages.en)
for (const code of localeCodes.slice(1)) {
  assert.deepEqual(shape(messages[code]), expectedShape, `${code} locale shape must match en`)
}

for (const code of localeCodes) {
  assert.equal(Object.keys(messages[code].pages.marketing).length, 9, `${code} must cover 9 marketing pages`)
  assert.equal(Object.keys(messages[code].pages.legal).length, 3, `${code} must cover 3 legal pages`)
  assert.ok(messages[code].pages.pricing.emptyTitle, `${code} must include pricing empty state`)
}

assert.equal(messages.ru.hero.visualUrl, 'shoply.store')
assert.ok(!JSON.stringify(messages.id).includes('Berbelanja'), 'Shoply brand must not be translated in Indonesian')
assert.ok(!JSON.stringify(messages.ru).includes('Магазинный'), 'Shoply brand must not be translated in Russian')

console.log(`✓ Shoply locale contract passed (${localeCodes.join(', ')})`)
