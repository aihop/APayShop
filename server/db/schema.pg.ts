import { pgTable, text, integer, real, index, uniqueIndex, boolean, timestamp, jsonb, serial, bigint } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ==========================================
// AINode Gateway / API Core Tables
// Merged from PROMPT.md (schema.sql)
// ==========================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  // 原 APay 用户属性
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  currentSessionId: text('current_session_id'), // 当前有效的会话 ID
  status: integer('status').default(1), // 1: 正常, 0: 禁用

  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }), // 邮箱验证时间

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const userWallets = pgTable('user_wallets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  cashBalance: bigint('cash_balance', { mode: 'bigint' }).notNull().default(sql`0`),
  grantBalance: bigint('grant_balance', { mode: 'bigint' }).notNull().default(sql`0`),
  subBalance: bigint('sub_balance', { mode: 'bigint' }).notNull().default(sql`0`),
  pointsBalance: bigint('points_balance', { mode: 'bigint' }).notNull().default(sql`0`),
  tierLevel: integer('tier_level').notNull().default(0),
  subExpiresAt: timestamp('sub_expires_at', { withTimezone: true }),
  status: integer('status').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userSessions = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  sessionIdHash: text('session_id_hash').notNull().unique(),
  status: text('status').notNull().default('active'),
  authMethod: text('auth_method').notNull().default('password'),
  deviceType: text('device_type'),
  browser: text('browser'),
  os: text('os'),
  userAgent: text('user_agent'),
  ip: text('ip'),
  country: text('country'),
  region: text('region'),
  city: text('city'),
  loggedInAt: timestamp('logged_in_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  replacedBySessionId: text('replaced_by_session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userStatusIdx: index('user_sessions_user_status_idx').on(table.userId, table.status),
  lastSeenIdx: index('user_sessions_last_seen_idx').on(table.lastSeenAt),
}))

export const userTokens = pgTable('user_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  name: text('name'), // Token 名称，方便管理
  expiresAt: timestamp('expires_at', { withTimezone: true }), // 过期时间
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }), // 最后使用时间
  revoked: boolean('revoked').notNull().default(false), // 是否已撤销
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// ==========================================
// APay Admin & eCommerce Tables
// ==========================================

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  permissions: jsonb('permissions').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// System-level API tokens for scripted /api/admin/* access. Scoped
// independently of the creating admin's own permissions (see
// server/middleware/auth.ts) — null/['*'] means full access, same
// convention as admins.permissions.
export const adminTokens = pgTable('admin_tokens', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id),
  token: text('token').notNull().unique(),
  name: text('name'),
  permissions: jsonb('permissions').$type<string[]>(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const oauthAccounts = pgTable('oauth_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(), // 'google', 'github', etc.
  providerAccountId: text('provider_account_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => {
  return {
    providerIdx: uniqueIndex('provider_account_idx').on(table.provider, table.providerAccountId)
  }
})

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  slug: text('slug').unique(),
  name: text('name').notNull(),
  price: real('price').notNull(),
  description: text('description'),
  content: text('content'), // Detailed HTML or Markdown content
  type: text('type').notNull(), // 'key', 'file', 'subscription', 'service', 'topup'
  imageUrl: text('image_url'), // Cover image
  views: integer('views').notNull().default(0), // View count
  imageUrls: jsonb('image_urls').$type<string[]>(), // JSON array of multiple image URLs
  resource: text('resource'), // general resource for non-unique items
  isActive: boolean('is_active').notNull().default(true),
  metaData: jsonb('meta_data'), // EAV Model: flexible JSON for custom attributes (e.g. size, color, version)
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const cards = pgTable('cards', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  cardNumber: text('card_number').notNull(),
  isUsed: boolean('is_used').notNull().default(false),
  orderId: text('order_id'), // Will reference orders.id when used
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const paymentMethods = pgTable('payment_methods', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(), // e.g., 'alipay', 'stripe'
  iconUrl: text('icon_url'),
  isActive: boolean('is_active').notNull().default(false),
  supportedLocales: text('supported_locales'), // Comma-separated locale whitelist, empty means all locales
  configJson: text('config_json'), // JSON object for API keys, etc.
  info: text('info'), // HTML for payment info
  create: text('create'), // JS for payment initiation
  callback: text('callback'), // HTML for callback info
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const emailProviders = pgTable('email_providers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(), // e.g., 'resend', 'bird', 'smtp'
  isActive: boolean('is_active').notNull().default(false),
  configJson: text('config_json'), // JSON object for API keys, from address, etc.
  sendScript: text('send_script'), // JS sandbox script for sending email
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const emailLogs = pgTable('email_logs', {
  id: serial('id').primaryKey(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  templateCode: text('template_code'),
  html: text('html'),
  provider: text('provider'),
  status: text('status').notNull().default('success'),
  messageId: text('message_id'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const orders = pgTable('orders', {
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
  metaData: jsonb('meta_data'), // Flexible JSON for custom order data
  visitorId: text('visitor_id'), // To track anonymous users
  subscriptionId: text('subscription_id'), // Link to parent subscription if this is a recurring payment
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  payStatus: text('pay_status').notNull().default('pending') // pending, paid, failed, refunded
}, (table) => [
  uniqueIndex('orders_source_external_order_unique').on(table.source, table.externalOrderId),
])

export const topups = pgTable('topups', {
  id: serial('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }).unique(),
  userId: integer('user_id').notNull().references(() => users.id),
  walletId: integer('wallet_id').notNull().references(() => userWallets.id),
  source: text('source').notNull().default('order'),
  paymentAmount: real('payment_amount').notNull(),
  paymentCurrency: text('payment_currency').notNull(),
  creditAmountCents: bigint('credit_amount_cents', { mode: 'bigint' }).notNull(),
  creditCurrency: text('credit_currency').notNull(),
  exchangeRate: real('exchange_rate').notNull().default(1),
  balanceType: text('balance_type').notNull().default('cash'),
  status: text('status').notNull().default('pending'),
  creditEventId: text('credit_event_id').notNull().unique(),
  refundEventId: text('refund_event_id').unique(),
  retryCount: integer('retry_count').notNull().default(0),
  shortfallCents: bigint('shortfall_cents', { mode: 'bigint' }).notNull().default(sql`0`),
  lastError: text('last_error'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  creditedAt: timestamp('credited_at', { withTimezone: true }),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userCreatedAtIdx: index('idx_topups_user_created_at').on(table.userId, table.createdAt),
  statusUpdatedAtIdx: index('idx_topups_status_updated_at').on(table.status, table.updatedAt),
}))

// ==========================================
// Subscriptions Table (Adyen/PayPal Recurring)
// ==========================================
export const subscriptions = pgTable('subscriptions', {
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
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  
  metaData: jsonb('meta_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(), // site_name, company_name, active_theme
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const paymentFailures = pgTable('payment_failures', {
  id: serial('id').primaryKey(),
  orderId: text('order_id').notNull(),
  cardBin: text('card_bin'),
  reason: text('reason').notNull(),
  amount: real('amount'),
  payMethod: text('pay_method'),
  contactEmail: text('contact_email'),
  rawResponse: text('raw_response'), // Full error response from gateway
  visitorId: text('visitor_id'), // To track anonymous users
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const failures = paymentFailures

export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: jsonb('events').$type<string[]>(), // Array of events, e.g., ['order.paid', 'order.created']
  secret: text('secret'), // Secret for signing payload to verify authenticity
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// 事件自动化规则:某事件(如 user.registered)触发某动作(如 grant_reward)+ 参数(config)。
export const eventRules = pgTable('event_rules', {
  id: serial('id').primaryKey(),
  event: text('event').notNull(),          // e.g. 'user.registered'
  action: text('action').notNull(),        // e.g. 'grant_reward'
  config: jsonb('config').$type<Record<string, any>>(), // 动作参数,如 {balanceType,amount,remark}
  enabled: boolean('enabled').notNull().default(true),
  remark: text('remark'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const logs = pgTable('logs', {
  id: serial('id').primaryKey(),
  level: text('level').notNull().default('info'), // 'info', 'warn', 'error', 'debug'
  message: text('message').notNull(),
  details: text('details'), // Optional JSON string or detailed stack trace
  source: text('source'), // e.g., 'webhook', 'admin', 'payment', 'system'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const visitorProfiles = pgTable('visitor_profiles', {
  visitorId: text('visitor_id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  ip: text('ip'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const visitorEvents = pgTable('visitor_events', {
  id: serial('id').primaryKey(),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const accessLogs = pgTable('access_logs', {
  id: serial('id').primaryKey(),
  path: text('path').notNull(),
  method: text('method').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  referrer: text('referrer'),
  country: text('country'),
  region: text('region'),
  city: text('city'),
  statusCode: integer('status_code'),
  duration: real('duration'),
  visitorId: text('visitor_id'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// Audit trail: who changed what in the admin panel. Deliberately NOT merged
// into `logs` — that table is free-text and has a user-facing "clear all"
// button, which would let anyone erase their own tracks.
export const operationLogs = pgTable('operation_logs', {
  id: serial('id').primaryKey(),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  createdAtIdx: index('operation_logs_created_at_idx').on(table.createdAt),
  actorIdx: index('operation_logs_actor_idx').on(table.actorId, table.createdAt),
  resourceIdx: index('operation_logs_resource_idx').on(table.resource, table.resourceId)
}))

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  key: text('key'),
  sort: integer('sort'),
  slug: text('slug').notNull().unique(), // Used for URL /blog/:slug
  title: text('title').notNull(),
  description: text('description'), // Short description for list view
  content: text('content'), // Rich text HTML or Markdown
  type: text('type').notNull().default('blog'), // e.g., 'blog', 'page', 'announcement'
  imageUrl: text('image_url'), // Cover image
  views: integer('views').notNull().default(0), // View count
  isActive: boolean('is_active').notNull().default(true),
  metaData: jsonb('meta_data'), // For SEO tags, view counts, or other flexible data
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
})

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  visitorId: text('visitor_id'),
  type: text('type').notNull(), // order_paid, key_delivered, subscription_activated, etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'), // { orderId, productId, slug, ... }
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})


// 余额变更流水（充值到账、后台直充/赠送、消费扣减…）。
// 与 user_wallets 各余额池同口径：金额放大 10^8 存储。
//
// 与 ainode 同名表的两点差异：
//  1. 去掉 transaction_id 外键——apay 没有 transactions 表，溯源改用 sourceType/sourceId
//     （如 order/<orderId>），语义更直接。
//  2. 增加 eventId 唯一键做幂等。支付回调会重试、用户也可能重复触发，没有这道锁就会重复入账。
//     入账一律先抢占 eventId，抢不到即视为已处理（见 server/utils/balance.ts）。
export const balanceLogs = pgTable('balance_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  walletId: integer('wallet_id').notNull().references(() => userWallets.id),
  balanceType: text('balance_type').notNull(), // cash | grant
  actionType: text('action_type').notNull().default('topup'), // topup | admin_recharge | order_payment | refund | adjust
  /** 本次变更金额，放大 10^8；正=入账，负=出账 */
  amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
  beforeBalanceCents: bigint('before_balance_cents', { mode: 'bigint' }).notNull(),
  afterBalanceCents: bigint('after_balance_cents', { mode: 'bigint' }).notNull(),
  /** 幂等键：同一 eventId 只入账一次 */
  eventId: text('event_id').notNull().unique(),
  sourceType: text('source_type').notNull().default('system'), // order | admin | system
  sourceId: text('source_id'),
  operatorAdminId: integer('operator_admin_id'),
  operatorName: text('operator_name').notNull().default(''),
  remark: text('remark').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  walletCreatedAtIdx: index('idx_balance_logs_wallet_created_at').on(table.walletId, table.createdAt),
}))

export const promoAgentTiers = pgTable('promo_agent_tiers', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  roleScope: text('role_scope').notNull().default('agent'),
  level: integer('level').notNull().default(1),
  discountRate: real('discount_rate').notNull().default(1),
  salesThreshold: real('sales_threshold').notNull().default(0),
  isFixed: boolean('is_fixed').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const promoMembers = pgTable('promo_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id).unique(),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('active'),
  promoCode: text('promo_code').notNull().unique(),
  inviteCode: text('invite_code').notNull().unique(),
  agentCode: text('agent_code').unique(),
  currentAgentTierId: integer('current_agent_tier_id').references(() => promoAgentTiers.id),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promoInviteRelations = pgTable('promo_invite_relations', {
  id: serial('id').primaryKey(),
  inviteeUserId: integer('invitee_user_id').notNull().references(() => users.id).unique(),
  inviterUserId: integer('inviter_user_id').notNull().references(() => users.id),
  source: text('source').notNull().default('register'),
  codeSnapshot: text('code_snapshot'),
  boundAt: timestamp('bound_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promoAgentRelations = pgTable('promo_agent_relations', {
  id: serial('id').primaryKey(),
  agentUserId: integer('agent_user_id').notNull().references(() => users.id).unique(),
  parentAgentUserId: integer('parent_agent_user_id').references(() => users.id),
  masterAgentUserId: integer('master_agent_user_id').references(() => users.id),
  depth: integer('depth').notNull().default(1),
  status: text('status').notNull().default('active'),
  boundAt: timestamp('bound_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promoOrderAttributions = pgTable('promo_order_attributions', {
  id: serial('id').primaryKey(),
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
  sourceType: text('source_type').notNull().default('direct'),
  metaData: jsonb('meta_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promoCommissions = pgTable('promo_commissions', {
  id: serial('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  ownerUserId: integer('owner_user_id').notNull().references(() => users.id),
  ownerPromoMemberId: integer('owner_promo_member_id').references(() => promoMembers.id),
  type: text('type').notNull(),
  sourceType: text('source_type').notNull().default('direct'),
  amount: real('amount').notNull(),
  rate: real('rate'),
  status: text('status').notNull().default('pending'),
  remark: text('remark'),
  metaData: jsonb('meta_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // 同一订单同一佣金类型只允许入账一次:结算是"先查后插",并发回调靠这条
  // 数据库级约束兜底防重复佣金(应用层冲突时忽略即可)
  orderTypeIdx: uniqueIndex('promo_commissions_order_type_idx').on(table.orderId, table.type),
}))
