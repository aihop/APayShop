import fs from 'node:fs'
// 从 apay/.env 静默载入 DB 连接串(不打印),供 server/db/pg.ts 惰性连接用
const envText = fs.readFileSync('/Users/hugh/code/aihop/apay/.env', 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*(QINGPU_DATABASE_URL|DATABASE_URL|POSTGRES_URL)\s*=\s*(.+)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const OFFER = process.argv[2] || '1005383484100'
const URL = `https://detail.1688.com/offer/${OFFER}.html`
const USER_ID = 7

// 真实 server 采集入口(内部走 ainode /ai/crawl + syncProductAggregates 入库)
const { collectByUrls } = await import('/Users/hugh/code/aihop/apay/app/themes/qingpu/server/listing/collect.ts')
const { qingpuSql } = await import('/Users/hugh/code/aihop/apay/app/themes/qingpu/server/db/pg.ts')

console.log(`━━━ 真调 collectByUrls(userId=${USER_ID}, [${OFFER}], force) —— 真采集 + 真入库 ━━━`)
const results = await collectByUrls(USER_ID, [URL], { force: true })
console.log('采集结果:', JSON.stringify(results, null, 1).slice(0, 400))

const pid = (results as any[])[0]?.productId
if (pid) {
  console.log(`\n━━━ 从 DB 读回入库结果(qingpu_listing_products / workspaces / channel_drafts)━━━`)
  const p = await qingpuSql`select product_id, title, source_product_id, preprocess_status, sku_count, updated_at from qingpu_listing_products where user_id = ${USER_ID} and product_id = ${pid} limit 1`
  console.log('products 行:', JSON.stringify(p[0] ?? '(无)'))
  const w = await qingpuSql`select product_id, schema_version from qingpu_listing_workspaces where user_id = ${USER_ID} and product_id = ${pid} limit 1`
  console.log('workspaces 行:', w.length ? '存在' : '(无)')
  const d = await qingpuSql`select channel from qingpu_listing_channel_drafts where user_id = ${USER_ID} and product_id = ${pid}`
  console.log('channel_drafts 渠道:', d.map((r: any) => r.channel).join(',') || '(无)')
}
await qingpuSql.end()
