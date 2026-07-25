import fs from 'node:fs'
const envText = fs.readFileSync('/Users/hugh/code/aihop/apay/.env', 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*(QINGPU_DATABASE_URL|DATABASE_URL|POSTGRES_URL)\s*=\s*(.+)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const USER_ID = 7, PID = 'ai-1688-1005383484100'
const { runListingGenerationStreamed } = await import('/Users/hugh/code/aihop/apay/app/themes/qingpu/server/listing/generate.ts')
const { qingpuSql } = await import('/Users/hugh/code/aihop/apay/app/themes/qingpu/server/db/pg.ts')

console.log(`━━━ 真调 runListingGenerationStreamed(${USER_ID}, ${PID}) —— 真加工(翻译/文案)+ 真入库 ━━━`)
await runListingGenerationStreamed(USER_ID, PID, async (evt: any) => {
  if (evt.type === 'stage') console.log(`  [${evt.stage}] ${evt.status}${evt.complete !== undefined ? ' complete='+evt.complete : ''}`)
  else if (evt.type === 'error') console.log(`  [error] ${evt.message}`)
})

console.log(`\n━━━ 从 DB 读回加工产物 ━━━`)
const p = await qingpuSql`select title, title_ru, preprocess_status, sku_count from qingpu_listing_products where user_id = ${USER_ID} and product_id = ${PID} limit 1`
console.log('原标题:', p[0]?.title)
console.log('俄标题(入库):', p[0]?.title_ru || '(空)')
console.log('预处理状态:', p[0]?.preprocess_status)
const w = await qingpuSql`select workspace from qingpu_listing_workspaces where user_id = ${USER_ID} and product_id = ${PID} limit 1`
const ws = typeof w[0]?.workspace === 'string' ? JSON.parse(w[0].workspace) : w[0]?.workspace
console.log('workspace.translation.title:', ws?.translation?.title || '(空)')
console.log('维度/属性译:', JSON.stringify(ws?.translation?.attributeStrings || {}).slice(0, 200))
await qingpuSql.end()
