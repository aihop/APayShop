import assert from 'node:assert/strict'
import { mkdirSync, symlinkSync, rmSync, existsSync } from 'node:fs'

// h3 createError shim for rateLimit under bare Node
globalThis.createError = (opts) => {
  const e = new Error(opts?.message || 'Error')
  e.statusCode = opts?.statusCode
  return e
}

const ROOT = '/Users/hugh/code/aihop/apay'
const QINGPU = `${ROOT}/app/themes/qingpu`
const ENGINE_DIR = `${QINGPU}/server/vendor/qingpu-engine`
const NM = `${ROOT}/node_modules/@qingpu-vendor`
const LINK = `${NM}/qingpu-engine`
if (!existsSync(LINK)) {
  mkdirSync(NM, { recursive: true })
  symlinkSync(ENGINE_DIR, LINK, 'dir')
}

let passed = 0
let failed = 0
const failures = []
function check(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`) }
  catch (err) { failed += 1; failures.push({ name, err }); console.log(`  ✗ ${name}\n      ${err.message}`) }
}

console.log('\n=== Qingpu support: intent & knowledge ===')
const { classifySupportQuestion, isDetailedSupportQuestion, shouldAutoExecuteSupportTool } =
  await import(`${QINGPU}/server/support/intent.ts`)
const { selectSupportKnowledge } = await import(`${QINGPU}/server/support/knowledge.ts`)

const intentCases = [
  ['你好', 'public', 'general'],
  ['这些设置分别影响什么', 'settings', 'model_settings', 'model-settings'],
  ['这个页面怎么使用', 'workspace', 'listing_workflow'],
  ['价格怎么设置才不会亏', 'workspace', 'pricing', 'pricing'],
  ['复制 SKU 会保留什么', 'workspace', 'sku_management', 'sku-management'],
  ['检查模型连接', 'settings', 'model_settings'],
  ['我的 Ozon 店铺为什么授权失败', 'stores', 'store_connection', 'store-connection'],
  ['发布前需要检查哪些内容', 'workspace', 'publishing', 'publishing'],
  ['余额不足应该去哪里充值', 'billing', 'billing', 'billing'],
  ['订单支付后在哪里查看', 'orders', 'orders', 'billing'],
]
for (const [q, scene, intent, article] of intentCases) {
  check(`intent: "${q}"@${scene} -> ${intent}`, () => {
    assert.equal(classifySupportQuestion(q, scene), intent)
    if (article) {
      const k = selectSupportKnowledge({ intent, scene, locale: 'zh' })
      assert.ok(k.articleIds.includes(article), `expected ${article}, got ${JSON.stringify(k.articleIds)}`)
    }
  })
}
check('general question injects no knowledge', () => {
  const k = selectSupportKnowledge({ intent: 'general', scene: 'public', locale: 'zh' })
  assert.deepEqual(k.articleIds, [])
})
check('isDetailedSupportQuestion: detailed phrasing -> true', () => {
  assert.equal(isDetailedSupportQuestion('为什么发布状态一直 pending'), true)
  assert.equal(isDetailedSupportQuestion('请详细分析佣金计算'), true)
})
check('isDetailedSupportQuestion: short greeting -> false', () => {
  assert.equal(isDetailedSupportQuestion('你好'), false)
})
check('shouldAutoExecuteSupportTool: matches explicit tool intent', () => {
  assert.equal(shouldAutoExecuteSupportTool('check_publish_readiness', '复查发布条件'), true)
  assert.equal(shouldAutoExecuteSupportTool('refresh_publish_status', '刷新发布状态'), true)
  assert.equal(shouldAutoExecuteSupportTool('test_model_connection', '检查模型连接'), true)
  assert.equal(shouldAutoExecuteSupportTool('test_store_connection', '帮我验证 Ozon 店铺授权'), true)
})
check('shouldAutoExecuteSupportTool: no match -> false', () => {
  assert.equal(shouldAutoExecuteSupportTool('check_publish_readiness', '你好'), false)
})

console.log('\n=== Qingpu support: markdown parsing & link safety ===')
const { parseSupportInline, parseSupportMarkdown } = await import(`${QINGPU}/utils/supportMarkdown.ts`)

check('inline: parses strong/code/link tokens', () => {
  const tokens = parseSupportInline('**重要** 用 `code` 见 [文档](https://x.com)')
  const types = tokens.map(t => t.type)
  assert.ok(types.includes('strong'))
  assert.ok(types.includes('code'))
  const link = tokens.find(t => t.type === 'link')
  assert.ok(link, 'expected a link token')
  assert.equal(link.href, 'https://x.com')
  assert.equal(link.external, true)
})
check('inline: script text is NOT turned into a link (no execution)', () => {
  const tokens = parseSupportInline('<script>alert(1)</script>')
  assert.ok(tokens.every(t => t.type !== 'link'), 'no link should be produced from script tag')
  assert.ok(tokens.every(t => !('href' in t)), 'no href attribute')
})
check('inline: javascript: href is neutralized by safeLink', () => {
  const tokens = parseSupportInline('[x](javascript:alert(1))')
  const link = tokens.find(t => t.type === 'link')
  assert.equal(link, undefined, 'javascript: link must be dropped')
})
check('inline: relative link is internal (external=false)', () => {
  const tokens = parseSupportInline('[帮助](/help/setup)')
  const link = tokens.find(t => t.type === 'link')
  assert.ok(link)
  assert.equal(link.external, false)
})
check('markdown: block structure (heading/list/quote/code/divider)', () => {
  const md = '# 标题\n\n正文\n\n- 项一\n- 项二\n\n> 引用\n\n```\ncodeblock\n```\n\n---'
  const blocks = parseSupportMarkdown(md)
  const types = blocks.map(b => b.type)
  assert.ok(types.includes('heading'))
  assert.ok(types.includes('unordered-list'))
  assert.ok(types.includes('quote'))
  assert.ok(types.includes('code'))
  assert.ok(types.includes('divider'))
  assert.ok(types.includes('paragraph'))
})
check('markdown: html in source stays as text, not a link', () => {
  const blocks = parseSupportMarkdown('<img src=x onerror=alert(1)>')
  const flat = JSON.stringify(blocks)
  assert.equal(flat.includes('href'), false, 'html must not be converted to a link')
})

console.log('\n=== Qingpu shared: normalize utils ===')
const { normalizeObject, normalizeDateToIso } = await import(`${QINGPU}/server/shared/normalize.ts`)
check('normalizeObject: string JSON -> object', () => assert.deepEqual(normalizeObject('{"a":1}'), { a: 1 }))
check('normalizeObject: passthrough object', () => assert.deepEqual(normalizeObject({ a: 1 }), { a: 1 }))
check('normalizeObject: invalid/empty -> {}', () => {
  assert.deepEqual(normalizeObject('not json'), {})
  assert.deepEqual(normalizeObject(null), {})
  assert.deepEqual(normalizeObject(42), {})
})
check('normalizeDateToIso: Date -> ISO', () =>
  assert.equal(normalizeDateToIso(new Date('2026-01-01T00:00:00Z')), '2026-01-01T00:00:00.000Z'))
check('normalizeDateToIso: invalid -> null', () => {
  assert.equal(normalizeDateToIso('not-a-date'), null)
  assert.equal(normalizeDateToIso(null), null)
})

console.log('\n=== Qingpu support: redaction (PII safety) ===')
const { redactSupportText } = await import(`${QINGPU}/server/support/redaction.ts`)
check('redact: api key pattern', () => {
  const r = redactSupportText('my key sk_live_abcd1234efgh5678 here')
  assert.equal(r.includes('sk_live_'), false)
  assert.ok(r.includes('[REDACTED]'))
})
check('redact: Bearer token', () => {
  const r = redactSupportText('Authorization Bearer abcdef1234567890xyz')
  assert.equal(r.includes('abcdef1234567890xyz'), false)
})
check('redact: maxLength truncation (non-hex input)', () => {
  const long = 'z'.repeat(1000)
  assert.equal(redactSupportText(long, 500).length, 500)
})
check('redact: harmless text untouched', () =>
  assert.equal(redactSupportText('我的店铺授权失败了'), '我的店铺授权失败了'))

console.log('\n=== Qingpu support: rate limiter ===')
const { assertSupportRateLimit } = await import(`${QINGPU}/server/support/rateLimit.ts`)
check('rate limit: allows under threshold', () => {
  const prev = globalThis.__qingpuSupportRateLimit
  globalThis.__qingpuSupportRateLimit = new Map()
  for (let i = 0; i < 5; i++) assertSupportRateLimit(999)
  if (prev === undefined) delete globalThis.__qingpuSupportRateLimit
  else globalThis.__qingpuSupportRateLimit = prev
})
check('rate limit: throws 429 when exceeded', () => {
  globalThis.__qingpuSupportRateLimit = new Map()
  let threw = false
  try { for (let i = 0; i < 61; i++) assertSupportRateLimit(1001) }
  catch (e) { threw = true; assert.equal(e.statusCode, 429) }
  assert.equal(threw, true)
  delete globalThis.__qingpuSupportRateLimit
})

console.log('\n=== Qingpu listing: helpers (vendor-powered) ===')
const {
  normalizePreprocessStatus,
  normalizeAssetStatus,
  isListingChannel,
  toListingProductListItem,
} = await import(`${QINGPU}/server/listing/helpers.ts`)
check('normalizePreprocessStatus: valid passthrough', () => {
  assert.equal(normalizePreprocessStatus('pending'), 'pending')
  assert.equal(normalizePreprocessStatus('ready'), 'ready')
  assert.equal(normalizePreprocessStatus('generated'), 'generated')
  assert.equal(normalizePreprocessStatus('published'), 'published')
})
check('normalizePreprocessStatus: invalid -> pending', () =>
  assert.equal(normalizePreprocessStatus('garbage'), 'pending'))
check('normalizeAssetStatus: valid/invalid', () => {
  assert.equal(normalizeAssetStatus('hosted'), 'hosted')
  assert.equal(normalizeAssetStatus('weird'), 'pending')
})
check('isListingChannel: ozon/wb true, amazon false', () => {
  assert.equal(isListingChannel('ozon'), true)
  assert.equal(isListingChannel('wb'), true)
  assert.equal(isListingChannel('amazon'), false)
})
check('toListingProductListItem: maps & normalizes', () => {
  const row = {
    id: 1, user_id: 2, product_id: 'P123', source_platform: '1688',
    source_url: 'https://1688.com/x', source_product_id: 'SP1', title: '商品',
    main_image_url: 'https://img/x.jpg', sku_count: 3, category_id: '45',
    category_type_id: null, category_name: '电子', preprocess_status: 'bogus',
    schema_version: 1, revision: '7', client_updated_at: null, synced_from: 'server-fetch',
    deleted_at: null, created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: '2026-02-01T00:00:00Z',
  }
  const item = toListingProductListItem(row)
  assert.equal(item.productId, 'P123')
  assert.equal(item.preprocessStatus, 'pending')
  assert.equal(item.revision, 7)
  assert.equal(item.categoryId, 45)
  assert.equal(item.categoryTypeId, null)
  assert.equal(item.softDeleted, false)
  assert.equal(item.updatedAt, '2026-02-01T00:00:00.000Z')
})

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
// cleanup symlink
try { rmSync(LINK, { recursive: true, force: true }) } catch {}
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(` - ${f.name}: ${f.err.message}`)
  process.exit(1)
}
