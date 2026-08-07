import assert from 'node:assert/strict'
import { classifySupportQuestion, isDetailedSupportQuestion, shouldAutoExecuteSupportTool } from '../app/themes/qingpu/server/support/intent.ts'
import { selectSupportKnowledge } from '../app/themes/qingpu/server/support/knowledge.ts'
import { parseSupportInline, parseSupportMarkdown } from '../app/themes/qingpu/utils/supportMarkdown.ts'

const cases = [
  { question: '你好', scene: 'public', intent: 'general', automaticTool: null },
  { question: '你好', scene: 'settings', intent: 'general', automaticTool: null },
  { question: '你好', scene: 'stores', intent: 'general', automaticTool: null },
  { question: '这些设置分别影响什么', scene: 'settings', intent: 'model_settings', article: 'model-settings', automaticTool: null },
  { question: '这个页面怎么使用', scene: 'workspace', intent: 'listing_workflow', automaticTool: null },
  { question: '价格怎么设置才不会亏', scene: 'workspace', intent: 'pricing', article: 'pricing', automaticTool: null },
  { question: '复制 SKU 会保留什么', scene: 'workspace', intent: 'sku_management', article: 'sku-management', automaticTool: null },
  { question: '模型 Base URL 应该怎么填', scene: 'settings', intent: 'model_settings', article: 'model-settings', automaticTool: null },
  { question: '检查模型连接', scene: 'settings', intent: 'model_settings', automaticTool: 'test_model_connection' },
  { question: '我的 Ozon 店铺为什么授权失败', scene: 'stores', intent: 'store_connection', article: 'store-connection', automaticTool: null },
  { question: '帮我验证 Ozon 店铺授权', scene: 'stores', intent: 'store_connection', automaticTool: 'test_store_connection' },
  { question: '发布前需要检查哪些内容', scene: 'workspace', intent: 'publishing', article: 'publishing', automaticTool: null },
  { question: '复查发布条件', scene: 'workspace', intent: 'publishing', automaticTool: 'check_publish_readiness' },
  { question: '发布状态一直 pending 怎么办', scene: 'publish_records', intent: 'publishing', article: 'publishing', automaticTool: null },
  { question: '刷新发布状态', scene: 'publish_records', intent: 'publishing', automaticTool: 'refresh_publish_status' },
  { question: '余额不足应该去哪里充值', scene: 'billing', intent: 'billing', article: 'billing', automaticTool: null },
  { question: '订单支付后在哪里查看', scene: 'orders', intent: 'orders', article: 'billing', automaticTool: null },
]

const tools = [
  'test_model_connection',
  'test_store_connection',
  'check_publish_readiness',
  'refresh_publish_status',
]

for (const testCase of cases) {
  const intent = classifySupportQuestion(testCase.question, testCase.scene)
  assert.equal(intent, testCase.intent, `intent mismatch: ${testCase.question}`)
  const knowledge = selectSupportKnowledge({ intent, scene: testCase.scene, locale: 'zh' })
  if (intent === 'general') {
    assert.deepEqual(knowledge.articleIds, [], `generic question should not inject knowledge: ${testCase.question}`)
  }
  if (testCase.article) {
    assert.ok(knowledge.articleIds.includes(testCase.article), `knowledge mismatch: ${testCase.question}`)
  }
  assert.ok(knowledge.articleIds.length <= 1, `too many knowledge articles: ${testCase.question}`)
  const automaticTools = tools.filter(tool => shouldAutoExecuteSupportTool(tool, testCase.question))
  assert.deepEqual(
    automaticTools,
    testCase.automaticTool ? [testCase.automaticTool] : [],
    `automatic tool mismatch: ${testCase.question}`,
  )
}

assert.equal(isDetailedSupportQuestion('怎么充值'), false)
assert.equal(isDetailedSupportQuestion('请详细说明怎么充值'), true)
assert.equal(isDetailedSupportQuestion('为什么发布失败'), true)
assert.equal(isDetailedSupportQuestion('Explain why the store authorization failed'), true)

const formatted = parseSupportMarkdown(`## 结论
**模型连接正常**，请按顺序操作：

1. 打开 \`铺货设置\`
2. 保存模型配置

- 检查 Base URL
- 检查模型名

\`\`\`json
{"status":"ok"}
\`\`\``)
assert.deepEqual(formatted.map(block => block.type), ['heading', 'paragraph', 'ordered-list', 'unordered-list', 'code'])
assert.equal(formatted.at(-1)?.type === 'code' ? formatted.at(-1)?.language : '', 'json')

const safeInline = parseSupportInline('查看 [铺货设置](/user/listing/settings) 或 [帮助](https://example.com)')
assert.equal(safeInline.filter(token => token.type === 'link').length, 2)
const bareRouteInline = parseSupportInline('点击导航栏或访问 /user/billing 页面，然后前往 /user/orders。')
assert.deepEqual(
  bareRouteInline.filter(token => token.type === 'link').map(token => token.type === 'link' ? token.href : ''),
  ['/user/billing', '/user/orders'],
)
const unsafeInline = parseSupportInline('[不要点击](javascript:alert(1)) <script>alert(1)</script>')
assert.equal(unsafeInline.some(token => token.type === 'link'), false)
assert.equal(unsafeInline.map(token => token.text).join('').includes('<script>'), true)

console.log(`Qingpu support verification passed: ${cases.length} scenarios + Markdown safety`)
