import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ==========================================
// AINode Gateway / API Core Tables
// Merged from PROMPT.md (schema.sql)
// ==========================================

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 原 APay 用户属性
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // Nullable for OAuth users
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  currentSessionId: text('current_session_id'), // 当前有效的会话 ID
  
  // 融合自 PROMPT.md 中转站用户属性
  CashBalance: integer('cash_balance', { mode: 'number' }).default(0), // 充值余额（永不过期），金额放大 10^8 倍存储
  GrantBalance: integer('grant_balance', { mode: 'number' }).default(0), // 订阅周期赠送余额（按周期清零），金额放大 10^8 倍存储
  SubBalance: integer('sub_balance', { mode: 'number' }).default(0), // 订阅余额（按周期清零），金额放大 10^8 倍存储
  SubExpiresAt: integer('sub_expires_at', { mode: 'timestamp' }), // 订阅过期时间
  TierLevel: integer('tier_level', { mode: 'number' }).default(0), // 订阅等级 (0: Free, 1: Pro, 2: Enterprise)，用于网关高并发优先级控制
  status: integer('status').default(1), // 1: 正常, 0: 禁用

  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp' }), // 邮箱验证时间

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const usersTokens = sqliteTable('users_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  name: text('name'), // Token 名称，方便管理
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // 过期时间
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }), // 最后使用时间
  revoked: integer('revoked').notNull().default(0), // 是否已撤销（0 否，1 是）
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// ==========================================
// APay Admin & eCommerce Tables
// ==========================================

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  permissions: text('permissions', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// System-level API tokens for scripted /api/admin/* access. Scoped
// independently of the creating admin's own permissions (see
// server/middleware/auth.ts) — null/['*'] means full access, same
// convention as admins.permissions.
export const adminTokens = sqliteTable('admin_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adminId: integer('admin_id').notNull().references(() => admins.id),
  token: text('token').notNull().unique(),
  name: text('name'),
  permissions: text('permissions', { mode: 'json' }).$type<string[]>(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  revoked: integer('revoked').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(), // 'google', 'github', etc.
  providerAccountId: text('provider_account_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique(),
  name: text('name').notNull(),
  price: real('price').notNull(),
  description: text('description'),
  content: text('content'), // Detailed HTML or Markdown content
  type: text('type').notNull(), // 'basic','key', 'file', 'subscription', 'service', 'topup'
  imageUrl: text('image_url'), // Cover image
  views: integer('views').notNull().default(0), // View count
  imageUrls: text('image_urls', { mode: 'json' }).$type<string[]>(), // JSON array of multiple image URLs
  resource: text('resource'), // general resource for non-unique items
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  metaData: text('meta_data', { mode: 'json' }), // EAV Model: flexible JSON for custom attributes (e.g. size, color, version)
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const cards = sqliteTable('cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  cardNumber: text('card_number').notNull(),
  isUsed: integer('is_used', { mode: 'boolean' }).notNull().default(false),
  orderId: text('order_id'), // Will reference orders.id when used
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const paymentMethods = sqliteTable('payment_methods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull(), // e.g., 'alipay', 'stripe'
  iconUrl: text('icon_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  supportedLocales: text('supported_locales'), // Comma-separated locale whitelist, empty means all locales
  configJson: text('config_json'), // JSON object for API keys, etc.
  info: text('info'), // HTML for payment info
  create: text('create'), // JS for payment initiation
  callback: text('callback'), // HTML for callback info
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const emailProviders = sqliteTable('email_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull(), // e.g., 'resend', 'bird', 'smtp'
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  configJson: text('config_json'), // JSON object for API keys, from address, etc.
  sendScript: text('send_script'), // JS sandbox script for sending email
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(), // UUID
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'), // 实付币种(CNY/USD…);快捷充值按币种校验区间并折算到账额度
  source: text('source'), // minimal_checkout 等订单来源；与 external_order_id 组成外部幂等键
  externalOrderId: text('external_order_id'),
  productId: integer('product_id').notNull().references(() => products.id),
  userId: integer('user_id').references(() => users.id), // Link to C-end user
  contactEmail: text('contact_email').notNull(),
  payMethod: text('pay_method'), // References paymentMethods.code
  tradeNo: text('trade_no'), // 3rd party transaction ID
  status: text('status').notNull().default('none'), // none, processing, delivered, active, expired
  deliveryInfo: text('delivery_info'), // delivered card or link
  metaData: text('meta_data', { mode: 'json' }), // Flexible JSON for custom order data
  visitorId: text('visitor_id'), // To track anonymous users
  subscriptionId: text('subscription_id'), // Link to parent subscription if this is a recurring payment
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  payStatus: text('pay_status').notNull().default('pending') // pending, paid, failed, refunded
}, (table) => [
  uniqueIndex('orders_source_external_order_unique').on(table.source, table.externalOrderId),
])

// ==========================================
// Subscriptions Table (Adyen/PayPal Recurring)
// ==========================================
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(), // Internal Subscription UUID
  gatewaySubId: text('gateway_sub_id'), // External Gateway ID (e.g. PayPal sub_xxx)
  userId: integer('user_id').references(() => users.id),
  productId: integer('product_id').notNull().references(() => products.id),
  payMethod: text('pay_method').notNull(), // e.g., 'paypal', 'adyen'
  status: text('status').notNull().default('active'), // 'active', 'canceled', 'expired', 'past_due'
  
  // Billing cycle
  interval: text('interval').notNull(), // 'day', 'week', 'month', 'year'
  intervalCount: integer('interval_count').notNull().default(1),
  
  // Pricing
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  
  // Timestamps
  currentPeriodStart: integer('current_period_start', { mode: 'timestamp' }),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  
  metaData: text('meta_data', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`)
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(), // site_name, company_name, active_theme
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch() * 1000)`),
})

export const paymentFailures = sqliteTable('payment_failures', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: text('order_id').notNull(),
  cardBin: text('card_bin'),
  reason: text('reason').notNull(),
  amount: real('amount'),
  payMethod: text('pay_method'),
  contactEmail: text('contact_email'),
  rawResponse: text('raw_response'), // Full error response from gateway
  visitorId: text('visitor_id'), // To track anonymous users
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const failures = paymentFailures

export const webhooks = sqliteTable('webhooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: text('events', { mode: 'json' }).$type<string[]>(), // Array of events, e.g., ['order.paid', 'order.created']
  secret: text('secret'), // Secret for signing payload to verify authenticity
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// 事件自动化规则:某事件触发某动作 + 参数(config)。
export const eventRules = sqliteTable('event_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event: text('event').notNull(),
  action: text('action').notNull(),
  config: text('config', { mode: 'json' }).$type<Record<string, any>>(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  remark: text('remark'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

export const logs = sqliteTable('logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  level: text('level').notNull().default('info'), // 'info', 'warn', 'error', 'debug'
  message: text('message').notNull(),
  details: text('details'), // Optional JSON string or detailed stack trace
  source: text('source'), // e.g., 'webhook', 'admin', 'payment', 'system'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const visitorProfiles = sqliteTable('visitor_profiles', {
  visitorId: text('visitor_id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  ip: text('ip'),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const visitorEvents = sqliteTable('visitor_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  visitorId: text('visitor_id').notNull(),
  ip: text('ip'),
  userId: integer('user_id').references(() => users.id),
  orderId: text('order_id').references(() => orders.id),
  productId: integer('product_id').references(() => products.id),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const accessLogs = sqliteTable('access_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  path: text('path').notNull(),
  method: text('method').notNull(), // HTTP method: GET, POST, etc.
  ip: text('ip'),
  userAgent: text('user_agent'),
  referrer: text('referrer'),
  country: text('country'),
  region: text('region'),
  city: text('city'),
  statusCode: integer('status_code'), // HTTP response status code
  duration: real('duration'), // Response time in milliseconds
  visitorId: text('visitor_id'),
  userId: integer('user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// Audit trail: who changed what in the admin panel. Deliberately NOT merged
// into `logs` — that table is free-text and has a user-facing "clear all"
// button, which would let anyone erase their own tracks.
export const operationLogs = sqliteTable('operation_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorType: text('actor_type').notNull().default('admin'), // admin | user | system
  actorId: integer('actor_id'), // no FK: the record must outlive a deleted actor
  actorName: text('actor_name'), // snapshot — still readable after a rename/delete
  action: text('action').notNull(), // create | update | delete | login | logout | ...
  resource: text('resource').notNull(), // products | orders | admins | settings | ...
  resourceId: text('resource_id'), // text, not int: orders.id is a string
  summary: text('summary'),
  details: text('details'), // JSON string
  path: text('path').notNull(),
  method: text('method').notNull(),
  statusCode: integer('status_code'), // 401/403 included — denied attempts matter
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, (table) => ({
  createdAtIdx: index('operation_logs_created_at_idx').on(table.createdAt),
  actorIdx: index('operation_logs_actor_idx').on(table.actorId, table.createdAt),
  resourceIdx: index('operation_logs_resource_idx').on(table.resource, table.resourceId)
}))

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key'),
  sort: integer('sort'),
  slug: text('slug').notNull().unique(), // Used for URL /blog/:slug
  title: text('title').notNull(),
  description: text('description'), // Short description for list view
  content: text('content'), // Rich text HTML or Markdown
  type: text('type').notNull().default('blog'), // e.g., 'blog', 'page', 'announcement'
  imageUrl: text('image_url'), // Cover image
  views: integer('views').notNull().default(0), // View count
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  metaData: text('meta_data', { mode: 'json' }), // For SEO tags, view counts, or other flexible data
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`)
})

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  visitorId: text('visitor_id'),
  type: text('type').notNull(), // order_paid, key_delivered, subscription_activated, etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: text('data', { mode: 'json' }), // { orderId, productId, slug, ... }
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})


// 余额变更流水（充值到账、后台直充/赠送、消费扣减…）。
// 与 users.CashBalance / GrantBalance 同口径：金额放大 10^8 存储。
//
// 与 ainode 同名表的两点差异：
//  1. 去掉 transaction_id 外键——apay 没有 transactions 表，溯源改用 sourceType/sourceId
//     （如 order/<orderId>），语义更直接。
//  2. 增加 eventId 唯一键做幂等。支付回调会重试、用户也可能重复触发，没有这道锁就会重复入账。
//     入账一律先抢占 eventId，抢不到即视为已处理（见 server/utils/balance.ts）。
export const balanceLogs = sqliteTable('balance_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  balanceType: text('balance_type').notNull(),
  actionType: text('action_type').notNull().default('topup'),
  // 与本文件 users.CashBalance 保持一致：sqlite 侧用 number 而非 bigint，
  // 否则同一份业务代码在三方言下拿到的类型不一致（bigint vs number）
  amountCents: integer('amount_cents', { mode: 'number' }).notNull(),
  beforeBalanceCents: integer('before_balance_cents', { mode: 'number' }).notNull(),
  afterBalanceCents: integer('after_balance_cents', { mode: 'number' }).notNull(),
  eventId: text('event_id').notNull().unique(),
  sourceType: text('source_type').notNull().default('system'),
  sourceId: text('source_id'),
  operatorAdminId: integer('operator_admin_id'),
  operatorName: text('operator_name').notNull().default(''),
  remark: text('remark').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const promoMembers = sqliteTable('promo_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id).unique(),
  role: text('role').notNull().default('member'), // member | agent | master_agent
  status: text('status').notNull().default('active'), // active | disabled
  promoCode: text('promo_code').notNull().unique(),
  inviteCode: text('invite_code').notNull().unique(),
  agentCode: text('agent_code').unique(),
  currentAgentTierId: integer('current_agent_tier_id').references(() => promoAgentTiers.id),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const promoInviteRelations = sqliteTable('promo_invite_relations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  inviteeUserId: integer('invitee_user_id').notNull().references(() => users.id).unique(),
  inviterUserId: integer('inviter_user_id').notNull().references(() => users.id),
  source: text('source').notNull().default('register'), // register | bind | manual
  codeSnapshot: text('code_snapshot'),
  boundAt: integer('bound_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const promoAgentTiers = sqliteTable('promo_agent_tiers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  roleScope: text('role_scope').notNull().default('agent'), // agent | master_agent
  level: integer('level').notNull().default(1),
  discountRate: real('discount_rate').notNull().default(1),
  salesThreshold: real('sales_threshold').notNull().default(0),
  isFixed: integer('is_fixed', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const promoAgentRelations = sqliteTable('promo_agent_relations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  agentUserId: integer('agent_user_id').notNull().references(() => users.id).unique(),
  parentAgentUserId: integer('parent_agent_user_id').references(() => users.id),
  masterAgentUserId: integer('master_agent_user_id').references(() => users.id),
  depth: integer('depth').notNull().default(1),
  status: text('status').notNull().default('active'),
  boundAt: integer('bound_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const promoOrderAttributions = sqliteTable('promo_order_attributions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: text('order_id').notNull().references(() => orders.id).unique(),
  buyerUserId: integer('buyer_user_id').references(() => users.id),
  buyerPromoMemberId: integer('buyer_promo_member_id').references(() => promoMembers.id),
  inviteUserId: integer('invite_user_id').references(() => users.id),
  agentUserId: integer('agent_user_id').references(() => users.id),
  parentAgentUserId: integer('parent_agent_user_id').references(() => users.id),
  masterAgentUserId: integer('master_agent_user_id').references(() => users.id),
  agentTierIdSnapshot: integer('agent_tier_id_snapshot'),
  agentTierNameSnapshot: text('agent_tier_name_snapshot'),
  discountRateSnapshot: real('discount_rate_snapshot'),
  sourceType: text('source_type').notNull().default('direct'), // direct | invite | agent | mixed
  metaData: text('meta_data', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const promoCommissions = sqliteTable('promo_commissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: text('order_id').notNull().references(() => orders.id),
  ownerUserId: integer('owner_user_id').notNull().references(() => users.id),
  ownerPromoMemberId: integer('owner_promo_member_id').references(() => promoMembers.id),
  type: text('type').notNull(), // invite_reward | agent_discount | master_override
  sourceType: text('source_type').notNull().default('direct'),
  amount: real('amount').notNull(),
  rate: real('rate'),
  status: text('status').notNull().default('pending'), // pending | available | settled | canceled
  remark: text('remark'),
  metaData: text('meta_data', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, (table) => ({
  // 同一订单同一佣金类型只允许入账一次(并发结算防重复,见 schema.pg.ts 同名索引)
  orderTypeIdx: uniqueIndex('promo_commissions_order_type_idx').on(table.orderId, table.type),
}))
