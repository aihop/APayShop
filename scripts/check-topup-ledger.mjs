#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

for (const path of [
  'server/db/schema.pg.ts',
  'server/db/schema.mysql.ts',
  'server/db/schema.sqlite.ts',
]) {
  const source = read(path)
  assert.match(source, /export const topups = /, `${path}: topups schema missing`)
  for (const column of ['order_id', 'wallet_id', 'credit_event_id', 'refund_event_id', 'shortfall_cents']) {
    assert.ok(source.includes(`'${column}'`), `${path}: topups.${column} missing`)
  }
}

for (const path of [
  'server/db/migrations/pg/0021_add_topups.sql',
  'server/db/migrations/mysql/0016_add_topups.sql',
  'server/db/migrations/sqlite/0019_add_topups.sql',
]) {
  const source = read(path)
  assert.ok(source.includes('review_required'), `${path}: safe historical review state missing`)
  assert.ok(source.includes('历史退款订单没有可确认的 APay 退款流水'), `${path}: historical refund review guard missing`)
  assert.ok(source.includes('历史退款流水与订单或到账流水不一致'), `${path}: inconsistent historical refund guard missing`)
  assert.ok(source.includes('历史到账流水与订单支付状态不一致'), `${path}: inconsistent historical credit guard missing`)
  assert.ok(source.includes('walletOwner'), `${path}: APay-owned carrier migration missing`)
  assert.ok(source.includes('minimal-checkout-recharge'), `${path}: external relay exclusion missing`)
}

for (const path of [
  'server/db/migrations/pg/meta/_journal.json',
  'server/db/migrations/mysql/meta/_journal.json',
  'server/db/migrations/sqlite/meta/_journal.json',
]) {
  const journal = JSON.parse(read(path))
  assert.equal(journal.entries.at(-1)?.tag.endsWith('_add_topups'), true, `${path}: topups journal entry missing`)
  journal.entries.forEach((entry, index) => assert.equal(entry.idx, index, `${path}: journal idx ${index} is invalid`))
}

const ledger = read('server/utils/topupLedger.ts')
assert.ok(ledger.includes("eq(orders.payStatus, ORDER_PAY_STATUS.PAID)"), 'automatic retry must require a paid order')
assert.ok(ledger.includes("eventId: topup.creditEventId"), 'credits must use the top-up idempotency key')
assert.ok(ledger.includes('TOPUP_STATUS.REVIEW_REQUIRED'), 'ambiguous credits must enter manual review')
assert.ok(ledger.includes("eq(topups.status, TOPUP_STATUS.REFUNDING)"), 'refunds must be claimed conditionally')
assert.ok(ledger.includes('退款处理中断，可能已写入扣款流水，需人工核对后处理'), 'ambiguous interrupted refunds must require manual review')
assert.ok(ledger.includes('退款与到账并发，资金结果不确定，需人工核对后处理'), 'credit/refund races must require manual review')
assert.ok(ledger.includes('存在到账流水但未确认钱包已加款，退款不能自动扣回，需人工核对'), 'unconfirmed credits must never be clawed back automatically')
assert.ok(ledger.includes('充值状态与到账流水不一致，退款不能自动处理，需人工核对'), 'missing credit evidence must require manual review')

const fulfillment = read('server/utils/fulfillment.ts')
assert.equal(fulfillment.includes('creditBalance('), false, 'generic fulfillment must not credit top-ups')

const payment = read('server/utils/orderPayment.ts')
assert.ok(payment.includes('settlePaidTopup(orderId)'), 'payment confirmation must settle local top-ups')
assert.ok(payment.includes('recoverCreditedApayTopup(orderId)'), 'paid callback replay must recover local top-up fulfillment')

const topupFulfillment = read('server/utils/apayTopupFulfillment.ts')
assert.ok(topupFulfillment.includes("eq(topups.status, 'credited')"), 'local top-up fulfillment must require confirmed credit')

const notify = read('app/themes/minimal/server/checkout/notify.ts')
assert.ok(notify.includes("attach.walletOwner === 'apay'"), 'Minimal notification must identify APay-owned wallets')
assert.ok(notify.includes("channel: 'local_wallet'"), 'APay wallet top-ups must not fall back to downstream events')

const wallet = read('server/api/users/wallet.get.ts')
assert.ok(wallet.includes('eq(topups.status, TOPUP_STATUS.CREDITED)'), 'wallet summary must count credited top-ups')

for (const path of [
  'server/api/users/wallet/topups.get.ts',
  'server/api/admin/topups/index.get.ts',
  'server/api/admin/topups/retry.post.ts',
  'server/api/cron/reconcile-topups.post.ts',
]) {
  assert.ok(read(path).length > 0, `${path}: top-up API missing`)
}

assert.ok(read('server/utils/adminPermissions.ts').includes("apiPrefixes: ['orders', 'topups']"), 'top-up admin APIs must use orders permission')
assert.ok(read('app/composables/useAdminNavConfig.ts').includes("to: '/admin/topups'"), 'top-up admin navigation missing')
assert.ok(read('app/pages/admin/topups.vue').includes("'/api/admin/topups/retry'"), 'top-up admin recovery UI missing')

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'apay-topup-ledger-'))
const databasePath = join(temporaryDirectory, 'migration.db')
try {
  const setup = `
PRAGMA foreign_keys = ON;
CREATE TABLE users (id integer PRIMARY KEY);
CREATE TABLE user_wallets (id integer PRIMARY KEY, user_id integer NOT NULL UNIQUE);
CREATE TABLE products (id integer PRIMARY KEY, slug text, type text NOT NULL);
CREATE TABLE orders (
  id text PRIMARY KEY, amount real NOT NULL, currency text, source text, product_id integer NOT NULL,
  user_id integer, meta_data text, pay_status text NOT NULL, paid_at integer, created_at integer NOT NULL
);
CREATE TABLE balance_logs (
  id integer PRIMARY KEY, user_id integer NOT NULL, wallet_id integer NOT NULL, balance_type text NOT NULL,
  amount_cents integer NOT NULL, event_id text NOT NULL UNIQUE, created_at integer NOT NULL
);
INSERT INTO users VALUES (1);
INSERT INTO user_wallets VALUES (10, 1);
INSERT INTO products VALUES (1, 'wallet-topup', 'topup');
INSERT INTO products VALUES (2, 'minimal-checkout-recharge', 'topup');
INSERT INTO products VALUES (3, 'service', 'service');
INSERT INTO orders VALUES ('PENDING', 10, 'USD', 'order', 1, 1, '{"recharge_amount":12}', 'pending', NULL, 100);
INSERT INTO orders VALUES ('CREDITED', 20, 'USD', 'order', 1, 1, '{"recharge_amount":25}', 'paid', 110, 101);
INSERT INTO orders VALUES ('REVIEW', 30, 'USD', 'order', 1, 1, '{"recharge_amount":35}', 'paid', 111, 102);
INSERT INTO orders VALUES ('REFUNDED', 40, 'USD', 'order', 1, 1, '{"recharge_amount":45}', 'refunded', 112, 103);
INSERT INTO orders VALUES ('REFUND_REVIEW', 45, 'USD', 'order', 1, 1, '{"recharge_amount":46}', 'refunded', 112, 103);
INSERT INTO orders VALUES ('REFUND_ONLY', 47, 'USD', 'order', 1, 1, '{"recharge_amount":47}', 'refunded', 112, 103);
INSERT INTO orders VALUES ('EXTERNAL', 50, 'USD', 'minimal_checkout', 2, 1, '{"checkoutBridge":{"attach":{"walletOwner":"external"}}}', 'paid', 113, 104);
INSERT INTO orders VALUES ('APAY', 60, 'USD', 'minimal_checkout', 2, 1, '{"checkoutBridge":{"attach":{"walletOwner":"apay"}},"recharge_amount":65}', 'paid', 114, 105);
INSERT INTO orders VALUES ('SERVICE', 70, 'USD', 'order', 3, 1, '{}', 'paid', 115, 106);
INSERT INTO orders VALUES ('BROKEN', 80, 'USD', 'order', 1, 1, '{broken', 'pending', NULL, 107);
INSERT INTO orders VALUES ('UNPAID_CREDIT', 90, 'USD', 'order', 1, 1, '{"recharge_amount":90}', 'pending', NULL, 108);
INSERT INTO balance_logs VALUES (1, 1, 10, 'cash', 2500000000, 'topup:CREDITED', 120);
INSERT INTO balance_logs VALUES (2, 1, 10, 'cash', 4500000000, 'topup:REFUNDED', 121);
INSERT INTO balance_logs VALUES (3, 1, 10, 'cash', -4500000000, 'refund:REFUNDED', 122);
INSERT INTO balance_logs VALUES (4, 1, 10, 'cash', 4600000000, 'topup:REFUND_REVIEW', 123);
INSERT INTO balance_logs VALUES (5, 1, 10, 'cash', -4700000000, 'refund:REFUND_ONLY', 124);
INSERT INTO balance_logs VALUES (6, 1, 10, 'cash', 9000000000, 'topup:UNPAID_CREDIT', 125);
`
  const migration = read('server/db/migrations/sqlite/0019_add_topups.sql').replaceAll('--> statement-breakpoint', '')
  execFileSync('sqlite3', [databasePath], { input: setup + migration, stdio: ['pipe', 'pipe', 'pipe'] })
  const rows = JSON.parse(execFileSync('sqlite3', ['-json', databasePath, 'SELECT order_id, status, last_error FROM topups ORDER BY order_id;'], { encoding: 'utf8' }))
  const states = Object.fromEntries(rows.map(row => [row.order_id, row]))
  assert.deepEqual(Object.keys(states), ['APAY', 'BROKEN', 'CREDITED', 'PENDING', 'REFUNDED', 'REFUND_ONLY', 'REFUND_REVIEW', 'REVIEW', 'UNPAID_CREDIT'])
  assert.equal(states.PENDING.status, 'pending')
  assert.equal(states.BROKEN.status, 'pending')
  assert.equal(states.CREDITED.status, 'credited')
  assert.equal(states.REFUNDED.status, 'refunded')
  assert.equal(states.REFUND_REVIEW.status, 'review_required')
  assert.ok(states.REFUND_REVIEW.last_error)
  assert.equal(states.REFUND_ONLY.status, 'review_required')
  assert.ok(states.REFUND_ONLY.last_error)
  assert.equal(states.REVIEW.status, 'review_required')
  assert.equal(states.APAY.status, 'review_required')
  assert.equal(states.UNPAID_CREDIT.status, 'review_required')
  assert.ok(states.UNPAID_CREDIT.last_error)
  assert.ok(states.REVIEW.last_error)
  assert.equal(execFileSync('sqlite3', [databasePath, 'PRAGMA foreign_key_check;'], { encoding: 'utf8' }).trim(), '')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}

console.log('✓ APay top-up ledger boundaries and SQLite migration')
