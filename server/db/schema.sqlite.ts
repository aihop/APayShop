import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ==========================================
// DataPaaS Gateway / API Core Tables
// Merged from PROMPT.md (schema.sql)
// ==========================================

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 原 APayShop 用户属性
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // Nullable for OAuth users
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  
  // 融合自 PROMPT.md 中转站用户属性
  CashBalance: integer('cash_balance', { mode: 'number' }).default(0), // 充值余额（永不过期），金额放大 10^8 倍存储
  GrantBalance: integer('grant_balance', { mode: 'number' }).default(0), // 订阅周期赠送余额（按周期清零），金额放大 10^8 倍存储
  GrantExpiresAt: integer('grant_expires_at', { mode: 'timestamp' }), // 订阅过期时间
  TierLevel: integer('tier_level', { mode: 'number' }).default(0), // 订阅等级 (0: Free, 1: Pro, 2: Enterprise)，用于网关高并发优先级控制
  status: integer('status').default(1), // 1: 正常, 0: 禁用
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

// ==========================================
// APayShop Admin & eCommerce Tables
// ==========================================

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(), // 'google', 'github', etc.
  providerAccountId: text('provider_account_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique(),
  name: text('name').notNull(),
  price: real('price').notNull(),
  description: text('description'),
  content: text('content'), // Detailed HTML or Markdown content
  type: text('type').notNull(), // 'basic','key', 'file', 'subscription', 'service', 'dynamic_api'
  imageUrl: text('image_url'), // Cover image
  views: integer('views').notNull().default(0), // View count
  imageUrls: text('image_urls', { mode: 'json' }).$type<string[]>(), // JSON array of multiple image URLs
  resource: text('resource'), // general resource for non-unique items
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  metaData: text('meta_data', { mode: 'json' }), // EAV Model: flexible JSON for custom attributes (e.g. size, color, version)
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const cards = sqliteTable('cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  cardNumber: text('card_number').notNull(),
  isUsed: integer('is_used', { mode: 'boolean' }).notNull().default(false),
  orderId: text('order_id'), // Will reference orders.id when used
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const paymentMethods = sqliteTable('payment_methods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull(), // e.g., 'alipay', 'stripe'
  iconUrl: text('icon_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  configJson: text('config_json'), // JSON object for API keys, etc.
  info: text('info'), // HTML for payment info
  create: text('create'), // JS for payment initiation
  callback: text('callback'), // HTML for callback info
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(), // UUID
  amount: real('amount').notNull(),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  payStatus: text('pay_status').notNull().default('pending') // pending, paid, failed, refunded
})

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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(), // site_name, company_name, active_theme
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch() * 1000)`),
})

// New table to store theme-specific configurations (JSON format)
export const themeSettings = sqliteTable('theme_settings', {
  themeName: text('theme_name').primaryKey(),
  config: text('config').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch() * 1000)`),
})

// Table for selling dynamic API quotas and serving as API Gateway credentials
export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name', { length: 50 }), // Add name field to align with model-api
  keyString: text('key_string', { length: 64 }).notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  status: integer('status').default(1), // 1: 正常, 0: 禁用
  
  // eCommerce / Quota fields
  orderId: text('order_id').references(() => orders.id),
  productId: integer('product_id').references(() => products.id),
  quotaLimit: integer('quota_limit', { mode: 'number' }).notNull().default(0), // BIGINT
  quotaUsed: integer('quota_used', { mode: 'number' }).notNull().default(0),   // BIGINT
  allowedModels: text('allowed_models', { mode: 'json' }).$type<string[]>(), // JSON array of allowed model codes
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const failures = sqliteTable('failures', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: text('order_id').notNull(),
  cardBin: text('card_bin'),
  reason: text('reason').notNull(),
  amount: real('amount'),
  payMethod: text('pay_method'),
  contactEmail: text('contact_email'),
  rawResponse: text('raw_response'), // Full error response from gateway
  visitorId: text('visitor_id'), // To track anonymous users
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const webhooks = sqliteTable('webhooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: text('events', { mode: 'json' }).$type<string[]>(), // Array of events, e.g., ['order.paid', 'order.created']
  secret: text('secret'), // Secret for signing payload to verify authenticity
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const logs = sqliteTable('logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  level: text('level').notNull().default('info'), // 'info', 'warn', 'error', 'debug'
  message: text('message').notNull(),
  details: text('details'), // Optional JSON string or detailed stack trace
  source: text('source'), // e.g., 'webhook', 'admin', 'payment', 'system'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const visitorProfiles = sqliteTable('visitor_profiles', {
  visitorId: text('visitor_id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const visitorEvents = sqliteTable('visitor_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  visitorId: text('visitor_id').notNull(),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(), // Used for URL /blog/:slug
  title: text('title').notNull(),
  description: text('description'), // Short description for list view
  content: text('content'), // Rich text HTML or Markdown
  type: text('type').notNull().default('blog'), // e.g., 'blog', 'page', 'announcement'
  imageUrl: text('image_url'), // Cover image
  views: integer('views').notNull().default(0), // View count
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  metaData: text('meta_data', { mode: 'json' }), // For SEO tags, view counts, or other flexible data
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
})
