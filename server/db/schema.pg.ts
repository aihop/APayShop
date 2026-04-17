import { pgTable, text, integer, real, uniqueIndex, boolean, timestamp, jsonb, serial, bigint, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ==========================================
// DataPaaS Gateway / API Core Tables
// Merged from PROMPT.md (schema.sql)
// ==========================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  // 原 APayShop 用户属性
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  
  CashBalance: bigint('cash_balance', { mode: 'bigint' }).default(sql`0`), // 充值余额（永不过期），金额放大 10^8 倍存储
  GrantBalance: bigint('grant_balance', { mode: 'bigint' }).default(sql`0`), // 订阅周期赠送余额（按周期清零），金额放大 10^8 倍存储

  TierLevel: integer('tier_level').default(0), // 订阅等级 (0: Free, 1: Pro, 2: Enterprise)，用于网关高并发优先级控制
  GrantExpiresAt: timestamp('grant_expires_at', { withTimezone: true }), // 订阅过期时间
  
  status: integer('status').default(1), // 1: 正常, 0: 禁用
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// ==========================================
// APayShop Admin & eCommerce Tables
// ==========================================

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
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
  type: text('type').notNull(), // 'key', 'file', 'subscription', 'service', 'dynamic_api'
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
  configJson: text('config_json'), // JSON object for API keys, etc.
  info: text('info'), // HTML for payment info
  create: text('create'), // JS for payment initiation
  callback: text('callback'), // HTML for callback info
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const orders = pgTable('orders', {
  id: text('id').primaryKey(), // UUID
  amount: real('amount').notNull(),
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
})

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

// New table to store theme-specific configurations (JSON format)
export const themeSettings = pgTable('theme_settings', {
  themeName: text('theme_name').primaryKey(),
  config: text('config').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Table for selling dynamic API quotas and serving as API Gateway credentials
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(), // Add name field to align with model-api
  keyString: varchar('key_string', { length: 64 }).notNull().unique(), // VARCHAR(64) UNIQUE NOT NULL
  userId: integer('user_id').references(() => users.id),
  status: integer('status').default(1), // 1: 正常, 0: 禁用 (For AI Gateway)
  tierLevel: integer('tier_level').notNull().default(0), // 优先级/层级 (For AI Gateway load balancing)
  
  // eCommerce / Quota fields (Optional for manually created gateway keys)
  orderId: text('order_id').references(() => orders.id),
  productId: integer('product_id').references(() => products.id), // Nullable now, as user can create without a product
  quotaLimit: bigint('quota_limit', { mode: 'number' }).notNull().default(0), // BIGINT
  quotaUsed: bigint('quota_used', { mode: 'number' }).notNull().default(0),   // BIGINT
  allowedModels: jsonb('allowed_models').$type<string[]>(), // JSON array of allowed model codes
  isActive: boolean('is_active').notNull().default(true), // Legacy compat

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const failures = pgTable('failures', {
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

export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: jsonb('events').$type<string[]>(), // Array of events, e.g., ['order.paid', 'order.created']
  secret: text('secret'), // Secret for signing payload to verify authenticity
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
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

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
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
