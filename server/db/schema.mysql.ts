import { mysqlTable, text, int, real, index, uniqueIndex, boolean, timestamp, json, bigint, varchar } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

// ==========================================
// AINode Gateway / API Core Tables
// Merged from PROMPT.md (schema.sql)
// ==========================================

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  // 原 APay 用户属性
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  lastLoginAt: timestamp('last_login_at'),
  currentSessionId: text('current_session_id'), // 当前有效的会话 ID
  
  CashBalance: bigint('cash_balance', { mode: 'bigint' }).default(sql`0`), // 充值余额（永不过期），金额放大 10^8 倍存储
  GrantBalance: bigint('grant_balance', { mode: 'bigint' }).default(sql`0`), // 订阅周期赠送余额（按周期清零），金额放大 10^8 倍存储
  SubBalance: bigint('sub_balance', { mode: 'bigint' }).default(sql`0`), // 订阅余额（按周期清零），金额放大 10^8 倍存储
  
  TierLevel: int('tier_level').default(0), // 订阅等级 (0: Free, 1: Pro, 2: Enterprise)，用于网关高并发优先级控制
  SubExpiresAt: timestamp('sub_expires_at'), // 订阅过期时间
  
  status: int('status').default(1), // 1: 正常, 0: 禁用

  emailVerifiedAt: timestamp('email_verified_at'), // 邮箱验证时间

  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const userTokens = mysqlTable('user_tokens', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  name: text('name'), // Token 名称，方便管理
  expiresAt: timestamp('expires_at'), // 过期时间
  lastUsedAt: timestamp('last_used_at'), // 最后使用时间
  revoked: boolean('revoked').notNull().default(false), // 是否已撤销
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// ==========================================
// APay Admin & eCommerce Tables
// ==========================================

export const admins = mysqlTable('admins', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 191 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  permissions: json('permissions').$type<string[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// System-level API tokens for scripted /api/admin/* access. Scoped
// independently of the creating admin's own permissions (see
// server/middleware/auth.ts) — null/['*'] means full access, same
// convention as admins.permissions.
export const adminTokens = mysqlTable('admin_tokens', {
  id: int('id').autoincrement().primaryKey(),
  adminId: int('admin_id').notNull().references(() => admins.id),
  token: text('token').notNull().unique(),
  name: text('name'),
  permissions: json('permissions').$type<string[]>(),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const oauthAccounts = mysqlTable('oauth_accounts', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),
  provider: varchar('provider', { length: 191 }).notNull(), // 'google', 'github', etc.
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => {
  return {
    providerIdx: uniqueIndex('provider_account_idx').on(table.provider, table.providerAccountId)
  }
})

export const products = mysqlTable('products', {
  id: int('id').autoincrement().primaryKey(),
  slug: text('slug').unique(),
  name: text('name').notNull(),
  price: real('price').notNull(),
  description: text('description'),
  content: text('content'), // Detailed HTML or Markdown content
  type: text('type').notNull(), // 'key', 'file', 'subscription', 'service', 'topup'
  imageUrl: text('image_url'), // Cover image
  views: int('views').notNull().default(0), // View count
  imageUrls: json('image_urls').$type<string[]>(), // JSON array of multiple image URLs
  resource: text('resource'), // general resource for non-unique items
  isActive: boolean('is_active').notNull().default(true),
  metaData: json('meta_data'), // EAV Model: flexible JSON for custom attributes (e.g. size, color, version)
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const cards = mysqlTable('cards', {
  id: int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull().references(() => products.id),
  cardNumber: text('card_number').notNull(),
  isUsed: boolean('is_used').notNull().default(false),
  orderId: text('order_id'), // Will reference orders.id when used
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const paymentMethods = mysqlTable('payment_methods', {
  id: int('id').autoincrement().primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(), // e.g., 'alipay', 'stripe'
  iconUrl: text('icon_url'),
  isActive: boolean('is_active').notNull().default(false),
  supportedLocales: text('supported_locales'), // Comma-separated locale whitelist, empty means all locales
  configJson: text('config_json'), // JSON object for API keys, etc.
  info: text('info'), // HTML for payment info
  create: text('create'), // JS for payment initiation
  callback: text('callback'), // HTML for callback info
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const emailProviders = mysqlTable('email_providers', {
  id: int('id').autoincrement().primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(), // e.g., 'resend', 'bird', 'smtp'
  isActive: boolean('is_active').notNull().default(false),
  configJson: text('config_json'), // JSON object for API keys, from address, etc.
  sendScript: text('send_script'), // JS sandbox script for sending email
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const orders = mysqlTable('orders', {
  id: text('id').primaryKey(), // UUID
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'), // 实付币种(CNY/USD…);快捷充值按币种校验区间并折算到账额度
  source: varchar('source', { length: 64 }), // minimal_checkout 等订单来源；与 external_order_id 组成外部幂等键
  externalOrderId: varchar('external_order_id', { length: 128 }),
  productId: int('product_id').notNull().references(() => products.id),
  userId: int('user_id').references(() => users.id), // Link to C-end user
  contactEmail: text('contact_email').notNull(),
  payMethod: text('pay_method'), // References paymentMethods.code
  tradeNo: text('trade_no'), // 3rd party transaction ID
  status: text('status').notNull().default('none'), // none, processing, delivered, active, expired
  deliveryInfo: text('delivery_info'), // delivered card or link
  metaData: json('meta_data'), // Flexible JSON for custom order data
  visitorId: text('visitor_id'), // To track anonymous users
  subscriptionId: text('subscription_id'), // Link to parent subscription if this is a recurring payment
  createdAt: timestamp('created_at').notNull().defaultNow(),
  paidAt: timestamp('paid_at'),
  payStatus: text('pay_status').notNull().default('pending') // pending, paid, failed, refunded
}, (table) => [
  uniqueIndex('orders_source_external_order_unique').on(table.source, table.externalOrderId),
])

// ==========================================
// Subscriptions Table (Adyen/PayPal Recurring)
// ==========================================
export const subscriptions = mysqlTable('subscriptions', {
  id: text('id').primaryKey(), // Internal Subscription UUID
  gatewaySubId: text('gateway_sub_id'), // External Gateway ID (e.g. PayPal sub_xxx)
  userId: int('user_id').references(() => users.id),
  productId: int('product_id').notNull().references(() => products.id),
  payMethod: text('pay_method').notNull(), // e.g., 'paypal', 'adyen'
  status: text('status').notNull().default('active'), // 'active', 'canceled', 'expired', 'past_due'
  
  // Billing cycle
  interval: text('interval').notNull(), // 'day', 'week', 'month', 'year'
  intervalCount: int('interval_count').notNull().default(1),
  
  // Pricing
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  
  // Timestamps
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  
  metaData: json('meta_data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const settings = mysqlTable('settings', {
  key: text('key').primaryKey(), // site_name, company_name, active_theme
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const paymentFailures = mysqlTable('payment_failures', {
  id: int('id').autoincrement().primaryKey(),
  orderId: text('order_id').notNull(),
  cardBin: text('card_bin'),
  reason: text('reason').notNull(),
  amount: real('amount'),
  payMethod: text('pay_method'),
  contactEmail: text('contact_email'),
  rawResponse: text('raw_response'), // Full error response from gateway
  visitorId: text('visitor_id'), // To track anonymous users
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const failures = paymentFailures

export const webhooks = mysqlTable('webhooks', {
  id: int('id').autoincrement().primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: json('events').$type<string[]>(), // Array of events, e.g., ['order.paid', 'order.created']
  secret: text('secret'), // Secret for signing payload to verify authenticity
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// 事件自动化规则:某事件触发某动作 + 参数(config)。
export const eventRules = mysqlTable('event_rules', {
  id: int('id').autoincrement().primaryKey(),
  event: text('event').notNull(),
  action: text('action').notNull(),
  config: json('config').$type<Record<string, any>>(),
  enabled: boolean('enabled').notNull().default(true),
  remark: text('remark'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const logs = mysqlTable('logs', {
  id: int('id').autoincrement().primaryKey(),
  level: text('level').notNull().default('info'), // 'info', 'warn', 'error', 'debug'
  message: text('message').notNull(),
  details: text('details'), // Optional JSON string or detailed stack trace
  source: text('source'), // e.g., 'webhook', 'admin', 'payment', 'system'
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const visitorProfiles = mysqlTable('visitor_profiles', {
  visitorId: text('visitor_id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  ip: text('ip'),
  firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  landingPath: text('landing_path'),
  firstPath: text('first_path'),
  lastPath: text('last_path'),
  firstReferrer: text('first_referrer'),
  lastReferrer: text('last_referrer'),
  firstSourceType: text('first_source_type'),
  lastSourceType: text('last_source_type'),
  firstSource: text('first_source'),
  lastSource: text('last_source'),
  firstMedium: text('first_medium'),
  lastMedium: text('last_medium'),
  firstCampaign: text('first_campaign'),
  lastCampaign: text('last_campaign'),
  firstContent: text('first_content'),
  lastContent: text('last_content'),
  firstTerm: text('first_term'),
  lastTerm: text('last_term'),
  country: text('country'),
  region: text('region'),
  city: text('city'),
  locale: text('locale'),
  currency: text('currency'),
  deviceType: text('device_type'),
  browser: text('browser'),
  os: text('os'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

export const visitorEvents = mysqlTable('visitor_events', {
  id: int('id').autoincrement().primaryKey(),
  visitorId: text('visitor_id').notNull(),
  ip: text('ip'),
  userId: int('user_id').references(() => users.id),
  orderId: text('order_id').references(() => orders.id),
  productId: int('product_id').references(() => products.id),
  eventName: text('event_name').notNull(),
  eventAction: text('event_action'),
  path: text('path'),
  referrer: text('referrer'),
  sourceType: text('source_type'),
  source: text('source'),
  medium: text('medium'),
  campaign: text('campaign'),
  content: text('content'),
  term: text('term'),
  country: text('country'),
  region: text('region'),
  city: text('city'),
  locale: text('locale'),
  currency: text('currency'),
  deviceType: text('device_type'),
  browser: text('browser'),
  os: text('os'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const accessLogs = mysqlTable('access_logs', {
  id: int('id').autoincrement().primaryKey(),
  path: text('path').notNull(),
  method: text('method').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  referrer: text('referrer'),
  country: text('country'),
  region: text('region'),
  city: text('city'),
  statusCode: int('status_code'),
  duration: real('duration'),
  visitorId: text('visitor_id'),
  userId: int('user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Audit trail: who changed what in the admin panel. Deliberately NOT merged
// into `logs` — that table is free-text and has a user-facing "clear all"
// button, which would let anyone erase their own tracks.
// The indexed string columns are varchar rather than text: MySQL cannot index
// a TEXT column without a prefix length.
export const operationLogs = mysqlTable('operation_logs', {
  id: int('id').autoincrement().primaryKey(),
  actorType: varchar('actor_type', { length: 32 }).notNull().default('admin'), // admin | user | system
  actorId: int('actor_id'), // no FK: the record must outlive a deleted actor
  actorName: varchar('actor_name', { length: 191 }), // snapshot — still readable after a rename/delete
  action: varchar('action', { length: 64 }).notNull(), // create | update | delete | login | logout | ...
  resource: varchar('resource', { length: 64 }).notNull(), // products | orders | admins | settings | ...
  resourceId: varchar('resource_id', { length: 191 }), // varchar, not int: orders.id is a string
  summary: text('summary'),
  details: text('details'), // JSON string
  path: text('path').notNull(),
  method: varchar('method', { length: 16 }).notNull(),
  statusCode: int('status_code'), // 401/403 included — denied attempts matter
  ip: varchar('ip', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  createdAtIdx: index('operation_logs_created_at_idx').on(table.createdAt),
  actorIdx: index('operation_logs_actor_idx').on(table.actorId, table.createdAt),
  resourceIdx: index('operation_logs_resource_idx').on(table.resource, table.resourceId)
}))

export const posts = mysqlTable('posts', {
  id: int('id').autoincrement().primaryKey(),
  key: text('key'),
  sort: int('sort'),
  slug: text('slug').notNull().unique(), // Used for URL /blog/:slug
  title: text('title').notNull(),
  description: text('description'), // Short description for list view
  content: text('content'), // Rich text HTML or Markdown
  type: text('type').notNull().default('blog'), // e.g., 'blog', 'page', 'announcement'
  imageUrl: text('image_url'), // Cover image
  views: int('views').notNull().default(0), // View count
  isActive: boolean('is_active').notNull().default(true),
  metaData: json('meta_data'), // For SEO tags, view counts, or other flexible data
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const notifications = mysqlTable('notifications', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').references(() => users.id),
  visitorId: text('visitor_id'),
  type: text('type').notNull(), // order_paid, key_delivered, subscription_activated, etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: json('data'), // { orderId, productId, slug, ... }
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
})


// 余额变更流水（充值到账、后台直充/赠送、消费扣减…）。
// 与 users.CashBalance / GrantBalance 同口径：金额放大 10^8 存储。
//
// 与 ainode 同名表的两点差异：
//  1. 去掉 transaction_id 外键——apay 没有 transactions 表，溯源改用 sourceType/sourceId
//     （如 order/<orderId>），语义更直接。
//  2. 增加 eventId 唯一键做幂等。支付回调会重试、用户也可能重复触发，没有这道锁就会重复入账。
//     入账一律先抢占 eventId，抢不到即视为已处理（见 server/utils/balance.ts）。
export const balanceLogs = mysqlTable('balance_logs', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => users.id),
  balanceType: varchar('balance_type', { length: 20 }).notNull(),
  actionType: varchar('action_type', { length: 50 }).notNull().default('topup'),
  amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
  beforeBalanceCents: bigint('before_balance_cents', { mode: 'bigint' }).notNull(),
  afterBalanceCents: bigint('after_balance_cents', { mode: 'bigint' }).notNull(),
  eventId: varchar('event_id', { length: 191 }).notNull().unique(),
  sourceType: varchar('source_type', { length: 32 }).notNull().default('system'),
  sourceId: varchar('source_id', { length: 191 }),
  operatorAdminId: int('operator_admin_id'),
  operatorName: varchar('operator_name', { length: 100 }).notNull().default(''),
  remark: text('remark'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const promoAgentTiers = mysqlTable('promo_agent_tiers', {
  id: int('id').autoincrement().primaryKey(),
  code: varchar('code', { length: 191 }).notNull().unique(),
  name: varchar('name', { length: 191 }).notNull(),
  roleScope: varchar('role_scope', { length: 64 }).notNull().default('agent'),
  level: int('level').notNull().default(1),
  discountRate: real('discount_rate').notNull().default(1),
  salesThreshold: real('sales_threshold').notNull().default(0),
  isFixed: boolean('is_fixed').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const promoMembers = mysqlTable('promo_members', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id).unique(),
  role: varchar('role', { length: 64 }).notNull().default('member'),
  status: varchar('status', { length: 64 }).notNull().default('active'),
  promoCode: varchar('promo_code', { length: 191 }).notNull().unique(),
  inviteCode: varchar('invite_code', { length: 191 }).notNull().unique(),
  agentCode: varchar('agent_code', { length: 191 }).unique(),
  currentAgentTierId: int('current_agent_tier_id').references(() => promoAgentTiers.id),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const promoInviteRelations = mysqlTable('promo_invite_relations', {
  id: int('id').autoincrement().primaryKey(),
  inviteeUserId: int('invitee_user_id').notNull().references(() => users.id).unique(),
  inviterUserId: int('inviter_user_id').notNull().references(() => users.id),
  source: varchar('source', { length: 64 }).notNull().default('register'),
  codeSnapshot: varchar('code_snapshot', { length: 191 }),
  boundAt: timestamp('bound_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const promoAgentRelations = mysqlTable('promo_agent_relations', {
  id: int('id').autoincrement().primaryKey(),
  agentUserId: int('agent_user_id').notNull().references(() => users.id).unique(),
  parentAgentUserId: int('parent_agent_user_id').references(() => users.id),
  masterAgentUserId: int('master_agent_user_id').references(() => users.id),
  depth: int('depth').notNull().default(1),
  status: varchar('status', { length: 64 }).notNull().default('active'),
  boundAt: timestamp('bound_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const promoOrderAttributions = mysqlTable('promo_order_attributions', {
  id: int('id').autoincrement().primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  buyerUserId: int('buyer_user_id').references(() => users.id),
  buyerPromoMemberId: int('buyer_promo_member_id').references(() => promoMembers.id),
  inviteUserId: int('invite_user_id').references(() => users.id),
  agentUserId: int('agent_user_id').references(() => users.id),
  parentAgentUserId: int('parent_agent_user_id').references(() => users.id),
  masterAgentUserId: int('master_agent_user_id').references(() => users.id),
  agentTierIdSnapshot: int('agent_tier_id_snapshot'),
  agentTierNameSnapshot: varchar('agent_tier_name_snapshot', { length: 191 }),
  discountRateSnapshot: real('discount_rate_snapshot'),
  sourceType: varchar('source_type', { length: 64 }).notNull().default('direct'),
  metaData: json('meta_data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    orderIdx: uniqueIndex('promo_order_attributions_order_id_idx').on(table.orderId),
  }
})

export const promoCommissions = mysqlTable('promo_commissions', {
  id: int('id').autoincrement().primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  ownerUserId: int('owner_user_id').notNull().references(() => users.id),
  ownerPromoMemberId: int('owner_promo_member_id').references(() => promoMembers.id),
  type: varchar('type', { length: 64 }).notNull(),
  sourceType: varchar('source_type', { length: 64 }).notNull().default('direct'),
  amount: real('amount').notNull(),
  rate: real('rate'),
  status: varchar('status', { length: 64 }).notNull().default('pending'),
  remark: text('remark'),
  metaData: json('meta_data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // 注意:pg/sqlite 两套已加 (order_id, type) 唯一索引防重复佣金;MySQL 的
  // order_id 是 TEXT(同 orders.id 主键),TEXT 列建唯一索引需要前缀长度,
  // 本套 schema 现状本就无法在严格 MySQL 上 push——如启用 MySQL 部署,先把
  // id/order_id 迁到 varchar 再补同名唯一索引
})
