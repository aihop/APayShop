#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const localesDir = path.join(root, 'locales')

const requiredLocales = ['zh', 'en', 'ru', 'zh-HK']
const requiredFiles = ['common.json', 'site.json', 'admin.json']

// 1. 验证老文件已被清理
const legacyFiles = ['zh.json', 'en.json', 'ru.json', 'zh-HK.json']
for (const legacy of legacyFiles) {
  const legacyPath = path.join(localesDir, legacy)
  assert.ok(!fs.existsSync(legacyPath), `Legacy single locale file ${legacy} should not exist`)
}

// 2. 验证各语言子目录及其三模块文件
for (const loc of requiredLocales) {
  const dir = path.join(localesDir, loc)
  assert.ok(fs.existsSync(dir), `Locale directory missing: ${loc}`)

  for (const file of requiredFiles) {
    const filePath = path.join(dir, file)
    assert.ok(fs.existsSync(filePath), `Locale file missing: ${loc}/${file}`)

    const content = fs.readFileSync(filePath, 'utf8').trim()
    let data
    try {
      data = JSON.parse(content || '{}')
    } catch (e) {
      assert.fail(`Invalid JSON syntax in ${loc}/${file}: ${e.message}`)
    }

    // 检查关键命名空间存在性与内容完整性
    if (file === 'common.json') {
      assert.ok(data.common, `${loc}/common.json must contain common namespace`)
      assert.ok(data.button, `${loc}/common.json must contain button namespace`)
      assert.ok(data.routeFallback, `${loc}/common.json must contain routeFallback namespace`)
      assert.ok(data.common.justNow, `${loc}/common.json must contain common.justNow`)
      assert.ok(data.common.save, `${loc}/common.json must contain common.save`)
    }
    if (file === 'site.json') {
      assert.ok(data.site, `${loc}/site.json must contain site namespace`)
    }
    if (file === 'admin.json') {
      assert.ok(data.admin, `${loc}/admin.json must contain admin namespace`)
    }
  }
}

// 3. 递归验证全语言所有模块的 100% 键对齐
function getAllKeys(obj, prefix = '') {
  let keys = []
  for (const k in obj) {
    const full = prefix ? prefix + '.' + k : k
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getAllKeys(obj[k], full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

for (const file of requiredFiles) {
  const allKeys = new Set()
  const keySets = {}
  for (const loc of requiredLocales) {
    const filePath = path.join(localesDir, loc, file)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}')
    const keys = getAllKeys(data)
    keySets[loc] = new Set(keys)
    for (const k of keys) allKeys.add(k)
  }

  for (const loc of requiredLocales) {
    const missing = [...allKeys].filter(k => !keySets[loc].has(k))
    assert.strictEqual(
      missing.length,
      0,
      `Key parity mismatch in ${loc}/${file}: missing ${missing.length} keys (${missing.slice(0, 5).join(', ')}...)`
    )
  }
}

// 4. 验证 nuxt.config.ts 中的 files 配置
const nuxtConfig = fs.readFileSync(path.join(root, 'nuxt.config.ts'), 'utf8')
assert.match(nuxtConfig, /files:\s*\[\s*'zh\/common\.json',\s*'zh\/site\.json'\s*\]/)
assert.match(nuxtConfig, /files:\s*\[\s*'en\/common\.json',\s*'en\/site\.json'\s*\]/)

// 5. 验证 useAdminLocale composable 存在
const useAdminLocalePath = path.join(root, 'app/composables/useAdminLocale.ts')
assert.ok(fs.existsSync(useAdminLocalePath), 'app/composables/useAdminLocale.ts must exist')

console.log('✓ Locales modular structure and 100% key parity validation passed')
