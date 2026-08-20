#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const schemas = [
  'server/db/schema.pg.ts',
  'server/db/schema.mysql.ts',
  'server/db/schema.sqlite.ts',
]
const legacyProperties = ['CashBalance', 'GrantBalance', 'SubBalance', 'SubExpiresAt', 'TierLevel']
for (const path of schemas) {
  const source = read(path)
  assert(source.includes("'user_wallets'"), `${path}: user_wallets missing`)
  assert(source.includes("'points_balance'"), `${path}: points_balance missing`)
  assert(source.includes("'wallet_id'"), `${path}: balance_logs.wallet_id missing`)
  for (const property of legacyProperties) {
    assert(!source.includes(`${property}:`), `${path}: legacy users.${property} remains`)
  }
}

const migrations = [
  'server/db/migrations/pg/0020_add_user_wallets.sql',
  'server/db/migrations/mysql/0015_add_user_wallets.sql',
  'server/db/migrations/sqlite/0018_add_user_wallets.sql',
]
for (const path of migrations) {
  const source = read(path)
  const createWallet = source.indexOf('user_wallets')
  const copyWallet = source.indexOf('cash_balance', createWallet + 1)
  const backfillLog = source.indexOf('wallet_id', copyWallet + 1)
  const dropLegacy = source.indexOf('DROP COLUMN', backfillLog + 1)
  assert(createWallet >= 0 && copyWallet > createWallet, `${path}: wallet backfill missing`)
  assert(backfillLog > copyWallet, `${path}: balance log wallet backfill missing`)
  assert(dropLegacy > backfillLog, `${path}: legacy columns must be dropped last`)
}

const businessFiles = [
  'server/utils/balance.ts',
  'server/utils/fulfillment.ts',
  'server/api/users/wallet.get.ts',
  'server/api/users/billing.get.ts',
  'server/api/users/dashboard.get.ts',
  'server/api/admin/users/[id].get.ts',
  'server/api/admin/users/index.get.ts',
  'server/api/admin/users/summary.get.ts',
  'server/api/orders/checkout.post.ts',
]
for (const path of businessFiles) {
  const source = read(path)
  for (const property of legacyProperties) {
    assert(!source.includes(`users.${property}`), `${path}: users.${property} remains`)
  }
}

const balance = read('server/utils/balance.ts')
assert(balance.includes('walletId: wallet.id'), 'new balance logs must store wallet_id')
assert(balance.includes('eq(balanceLogs.walletId, wallet.id)'), 'balance log reads must be wallet scoped')

const baseline = read('scripts/migrate-local-ainode-apay-baseline.mjs')
assert(baseline.includes('shared-database baseline is retired'), 'shared AINode/APay database script must be retired')

console.log('✓ APay user wallet migration boundaries')
