import { mysqlTable, text, int, real, uniqueIndex, boolean, timestamp, json, bigint, varchar } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

// ==========================================
// AINode Gateway / API Core Tables
// Merged from PROMPT.md (schema.sql)
// ==========================================

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  // 原 APayShop 用户属性
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  lastLoginAt: timestamp('last_login_at'),
  
  CashBalance: bigint('cash_balance', { mode: 'bigint' }).default(sql`0`), // 充值余额（永不过期），金额放大 10^8 倍存储
  GrantBalance: bigint('grant_balance', { mode: 'bigint' }).default(sql`0`), // 订阅周期赠送余额（按周期清零），金额放大 10^8 倍存储
  SubBalance: bigint('sub_balance', { mode: 'bigint' }).default(sql`0`), // 订阅余额（按周期清零），金额放大 10^8 倍存储
  
  TierLevel: int('tier_level').default(0), // 订阅等级 (0: Free, 1: Pro, 2: Enterprise)，用于网关高并发优先级控制
  SubExpiresAt: timestamp('sub_expires_at'), // 订阅过期时间
  
  status: int('status').default(1), // 1: 正常, 0: 禁用

  emailVerifiedAt: timestamp('email_verified_at'), // 邮箱验证时间
  emailVerifyToken: text('email_verify_token'), // 邮箱验证令牌
  emailVerifyExpiresAt: timestamp('email_verify_expires_at'), // 令牌过期时间

  createdAt: timestamp('created_at').notNull().defaultNow()
})

// ==========================================
// APayShop Admin & eCommerce Tables
// ==========================================

export const admins = mysqlTable('admins', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 191 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
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
})

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

// New table to store theme-specific configurations (JSON format)
export const themeSettings = mysqlTable('theme_settings', {
  themeName: text('theme_name').primaryKey(),
  config: text('config').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const failures = mysqlTable('failures', {
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
