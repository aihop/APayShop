#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import postgres from 'postgres'
import { aihopModels } from '../app/themes/aihop/data/models.ts'
import { aihopGateways } from '../app/themes/aihop/data/gateways.ts'
import { aihopPlans } from '../app/themes/aihop/data/plans.ts'

const root = process.cwd()

// 读取 .env
const envPath = path.resolve(root, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=')
      process.env[k.trim()] = v.join('=').replace(/^["']|["']$/g, '').trim()
    }
  }
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRESQL_URL
if (!connectionString) {
  console.error('✗ 错误: 未在 .env 中找到 DATABASE_URL / POSTGRES_URL 配置')
  process.exit(1)
}

console.log(`\n======================================================`)
console.log(`[APay & AIHop] 正在连接数据库: ${connectionString.replace(/:[^:@]+@/, ':****@')}`)
console.log(`======================================================\n`)

const sql = postgres(connectionString, { prepare: false })

async function hashPassword(password) {
  const scrypt = new Scrypt()
  const hash = new Hash(scrypt)
  return await hash.make(password)
}

async function main() {
  console.log('[1/4] 执行 APay 核心数据表结构创建 (PostgreSQL)...')

  const coreDdl = `
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY NOT NULL,
      email text NOT NULL,
      password_hash text,
      nickname text,
      avatar_url text,
      last_login_at timestamp with time zone,
      cash_balance bigint DEFAULT 0,
      grant_balance bigint DEFAULT 0,
      sub_balance bigint DEFAULT 0,
      tier_level integer DEFAULT 0,
      sub_expires_at timestamp with time zone,
      status integer DEFAULT 1,
      current_session_id text,
      email_verified_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT users_email_unique UNIQUE(email)
    );

    CREATE TABLE IF NOT EXISTS user_wallets (
      id serial PRIMARY KEY NOT NULL,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE cascade,
      cash_balance bigint DEFAULT 0 NOT NULL,
      grant_balance bigint DEFAULT 0 NOT NULL,
      sub_balance bigint DEFAULT 0 NOT NULL,
      points_balance bigint DEFAULT 0 NOT NULL,
      tier_level integer DEFAULT 0 NOT NULL,
      sub_expires_at timestamp with time zone,
      status integer DEFAULT 1 NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT user_wallets_user_id_unique UNIQUE(user_id)
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id serial PRIMARY KEY NOT NULL,
      user_id integer NOT NULL REFERENCES users(id),
      session_id_hash text NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      auth_method text DEFAULT 'password' NOT NULL,
      device_type text,
      browser text,
      os text,
      user_agent text,
      ip text,
      country text,
      region text,
      city text,
      logged_in_at timestamp with time zone DEFAULT now() NOT NULL,
      last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
      ended_at timestamp with time zone,
      replaced_by_session_id text,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT user_sessions_session_id_hash_unique UNIQUE(session_id_hash)
    );

    CREATE TABLE IF NOT EXISTS user_tokens (
      id serial PRIMARY KEY NOT NULL,
      user_id integer NOT NULL REFERENCES users(id),
      token text NOT NULL,
      name text,
      expires_at timestamp with time zone,
      last_used_at timestamp with time zone,
      revoked boolean DEFAULT false NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT user_tokens_token_unique UNIQUE(token)
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id serial PRIMARY KEY NOT NULL,
      user_id integer NOT NULL REFERENCES users(id),
      provider text NOT NULL,
      provider_account_id text NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS provider_account_idx ON oauth_accounts (provider, provider_account_id);

    CREATE TABLE IF NOT EXISTS admins (
      id serial PRIMARY KEY NOT NULL,
      username text NOT NULL,
      password_hash text NOT NULL,
      permissions jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT admins_username_unique UNIQUE(username)
    );

    CREATE TABLE IF NOT EXISTS admin_tokens (
      id serial PRIMARY KEY NOT NULL,
      admin_id integer NOT NULL REFERENCES admins(id),
      token text NOT NULL,
      name text,
      permissions jsonb,
      expires_at timestamp with time zone,
      last_used_at timestamp with time zone,
      revoked boolean DEFAULT false NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT admin_tokens_token_unique UNIQUE(token)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key text PRIMARY KEY NOT NULL,
      value text NOT NULL,
      description text,
      updated_at timestamp with time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS products (
      id serial PRIMARY KEY NOT NULL,
      slug text,
      name text NOT NULL,
      price real NOT NULL,
      description text,
      content text,
      type text NOT NULL,
      image_url text,
      views integer DEFAULT 0 NOT NULL,
      image_urls jsonb,
      resource text,
      is_active boolean DEFAULT true NOT NULL,
      meta_data jsonb,
      sort_order integer DEFAULT 0 NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT products_slug_unique UNIQUE(slug)
    );

    CREATE TABLE IF NOT EXISTS cards (
      id serial PRIMARY KEY NOT NULL,
      product_id integer NOT NULL REFERENCES products(id),
      card_number text NOT NULL,
      is_used boolean DEFAULT false NOT NULL,
      order_id text,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id serial PRIMARY KEY NOT NULL,
      name text NOT NULL,
      code text NOT NULL,
      icon_url text,
      is_active boolean DEFAULT false NOT NULL,
      supported_locales text,
      config_json text,
      info text,
      "create" text,
      callback text,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT payment_methods_code_unique UNIQUE(code)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id text PRIMARY KEY NOT NULL,
      amount real NOT NULL,
      currency text DEFAULT 'USD' NOT NULL,
      source text,
      external_order_id text,
      product_id integer NOT NULL REFERENCES products(id),
      user_id integer REFERENCES users(id),
      contact_email text NOT NULL,
      pay_method text,
      trade_no text,
      status text DEFAULT 'none' NOT NULL,
      delivery_info text,
      meta_data jsonb,
      visitor_id text,
      subscription_id text,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      paid_at timestamp with time zone,
      pay_status text DEFAULT 'pending' NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS orders_source_external_order_unique ON orders (source, external_order_id);

    CREATE TABLE IF NOT EXISTS topups (
      id text PRIMARY KEY NOT NULL,
      user_id integer NOT NULL REFERENCES users(id),
      order_id text REFERENCES orders(id),
      amount bigint NOT NULL,
      currency text DEFAULT 'USD' NOT NULL,
      type text NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      pay_method text,
      trade_no text,
      meta_data jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      paid_at timestamp with time zone
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id text PRIMARY KEY NOT NULL,
      gateway_sub_id text,
      user_id integer REFERENCES users(id),
      product_id integer NOT NULL REFERENCES products(id),
      pay_method text NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      interval text NOT NULL,
      interval_count integer DEFAULT 1 NOT NULL,
      amount real NOT NULL,
      currency text DEFAULT 'USD' NOT NULL,
      current_period_start timestamp with time zone,
      current_period_end timestamp with time zone,
      cancel_at_period_end boolean DEFAULT false,
      meta_data jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS posts (
      id serial PRIMARY KEY NOT NULL,
      key text,
      sort integer,
      slug text NOT NULL,
      title text NOT NULL,
      description text,
      content text,
      type text DEFAULT 'blog' NOT NULL,
      image_url text,
      views integer DEFAULT 0 NOT NULL,
      is_active boolean DEFAULT true NOT NULL,
      meta_data jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now(),
      CONSTRAINT posts_slug_unique UNIQUE(slug)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id serial PRIMARY KEY NOT NULL,
      user_id integer REFERENCES users(id),
      visitor_id text,
      type text NOT NULL,
      title text NOT NULL,
      message text NOT NULL,
      data jsonb,
      is_read boolean DEFAULT false NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS balance_logs (
      id serial PRIMARY KEY NOT NULL,
      user_id integer NOT NULL REFERENCES users(id),
      wallet_id integer,
      transaction_id text,
      type text NOT NULL,
      amount bigint NOT NULL,
      balance_before bigint NOT NULL,
      balance_after bigint NOT NULL,
      description text,
      source_type text DEFAULT 'system' NOT NULL,
      source_id text,
      event_id text,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS balance_logs_event_id_unique ON balance_logs (event_id);

    CREATE TABLE IF NOT EXISTS operation_logs (
      id serial PRIMARY KEY NOT NULL,
      actor_type text DEFAULT 'admin' NOT NULL,
      actor_id integer,
      actor_name text,
      action text NOT NULL,
      resource text NOT NULL,
      resource_id text,
      summary text,
      details text,
      path text NOT NULL,
      method text NOT NULL,
      status_code integer,
      ip text,
      user_agent text,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS access_logs (
      id serial PRIMARY KEY NOT NULL,
      path text NOT NULL,
      method text NOT NULL,
      ip text,
      user_agent text,
      referrer text,
      country text,
      region text,
      city text,
      status_code integer,
      duration real,
      visitor_id text,
      user_id integer REFERENCES users(id),
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visitor_profiles (
      visitor_id text PRIMARY KEY NOT NULL,
      user_id integer REFERENCES users(id),
      ip text,
      first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
      last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
      landing_path text,
      first_path text,
      last_path text,
      first_referrer text,
      last_referrer text,
      first_source_type text,
      last_source_type text,
      first_source text,
      last_source text,
      first_medium text,
      last_medium text,
      first_campaign text,
      last_campaign text,
      first_content text,
      last_content text,
      first_term text,
      last_term text,
      country text,
      region text,
      city text,
      locale text,
      currency text,
      device_type text,
      browser text,
      os text,
      user_agent text,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visitor_events (
      id serial PRIMARY KEY NOT NULL,
      visitor_id text NOT NULL,
      ip text,
      user_id integer REFERENCES users(id),
      order_id text REFERENCES orders(id),
      product_id integer REFERENCES products(id),
      event_name text NOT NULL,
      event_action text,
      path text,
      referrer text,
      source_type text,
      source text,
      medium text,
      campaign text,
      content text,
      term text,
      country text,
      region text,
      city text,
      locale text,
      currency text,
      device_type text,
      browser text,
      os text,
      user_agent text,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
  `

  await sql.unsafe(coreDdl)
  console.log('✓ APay 核心表创建完成！')

  // ==========================================================
  console.log('\n[2/4] 创建 AIHop 专属独立数据表...')

  const aihopDdl = `
    CREATE TABLE IF NOT EXISTS aihop_models (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(128) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      vendor VARCHAR(64) NOT NULL,
      currency VARCHAR(16) NOT NULL DEFAULT 'USD',
      price_input DOUBLE PRECISION NOT NULL DEFAULT 0,
      price_output DOUBLE PRECISION NOT NULL DEFAULT 0,
      price_cache_read DOUBLE PRECISION,
      price_cache_write DOUBLE PRECISION,
      context_window INTEGER,
      max_output_tokens INTEGER,
      scores TEXT,
      badges TEXT,
      scenes TEXT,
      reasoning INTEGER DEFAULT 0,
      open_weights INTEGER DEFAULT 0,
      is_free INTEGER DEFAULT 0,
      hidden INTEGER DEFAULT 0,
      released_at VARCHAR(64),
      updated_at VARCHAR(64),
      billing TEXT,
      sources TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS aihop_gateways (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      models TEXT NOT NULL,
      primary_model_key VARCHAR(64) NOT NULL,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      uptime VARCHAR(32) NOT NULL DEFAULT '99.99%',
      price_per_m DOUBLE PRECISION NOT NULL DEFAULT 0,
      price_label VARCHAR(64) NOT NULL,
      official_price_cny DOUBLE PRECISION NOT NULL DEFAULT 0,
      savings_percent INTEGER NOT NULL DEFAULT 0,
      is_self_operated INTEGER DEFAULT 0,
      badge VARCHAR(128),
      badge_tone VARCHAR(32),
      base_url TEXT NOT NULL,
      features TEXT NOT NULL,
      caveat TEXT,
      hidden INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS aihop_coding_plans (
      slug VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      vendor VARCHAR(64) NOT NULL,
      vendor_label VARCHAR(128) NOT NULL,
      vendor_color VARCHAR(64) NOT NULL,
      region VARCHAR(32) NOT NULL DEFAULT 'international',
      type VARCHAR(32) NOT NULL DEFAULT 'coding_plan',
      price_label VARCHAR(64) NOT NULL,
      price_monthly_cny INTEGER NOT NULL DEFAULT 0,
      payment_methods TEXT NOT NULL,
      network_requirement VARCHAR(128) NOT NULL,
      period VARCHAR(64) NOT NULL DEFAULT '按月订阅',
      quota_note TEXT NOT NULL,
      models TEXT NOT NULL,
      tools TEXT,
      highlights TEXT NOT NULL,
      caveats TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'hot',
      official_url TEXT,
      guide_url TEXT,
      hidden INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `

  await sql.unsafe(aihopDdl)
  console.log('✓ AIHop 数据表创建完成！')

  // ==========================================================
  console.log('\n[3/4] 写入 APay 系统默认初始化数据...')

  // 1. 初始化超级管理员 (默认: admin / admin123456)
  const existingAdmins = await sql`SELECT count(*)::int as count FROM admins`
  if (existingAdmins[0].count === 0) {
    const defaultPassword = process.env.APAY_ADMIN_PASSWORD || 'admin123456'
    const passwordHash = await hashPassword(defaultPassword)
    await sql`
      INSERT INTO admins (username, password_hash, permissions, created_at)
      VALUES ('admin', ${passwordHash}, '["*"]'::jsonb, now())
      ON CONFLICT (username) DO NOTHING;
    `
    console.log(`  ✓ 成功创建默认管理员账户: admin (默认密码: ${defaultPassword})`)
  } else {
    console.log(`  ℹ 管理员账户已存在，跳过`)
  }

  // 2. 初始化核心系统设置 Settings
  const defaultSettings = [
    { key: 'site_title', value: 'AIHop - 中文 AI 模型排行与选型降费指南', desc: '站点标题' },
    { key: 'site_name', value: 'AIHop', desc: '站点名称' },
    { key: 'site_description', value: '中文 AI 模型排行与选型站，回答用什么模型与哪个便宜，提供模型性价比对比与中转专线配置。', desc: '站点描述' },
    { key: 'default_locale', value: 'zh', desc: '默认语言' },
    { key: 'supported_locales', value: 'zh,en', desc: '支持语言' },
    { key: 'currency', value: 'CNY', desc: '默认货币' },
    { key: 'allow_guest_checkout', value: 'true', desc: '允许游客直接访问与选型' },
    { key: 'aihop_home_scene', value: 'chat', desc: '首页推荐场景' },
  ]

  for (const s of defaultSettings) {
    await sql`
      INSERT INTO settings (key, value, description, updated_at)
      VALUES (${s.key}, ${s.value}, ${s.desc}, now())
      ON CONFLICT (key) DO NOTHING;
    `
  }
  console.log(`  ✓ 核心 Settings 系统配置初始化完成`)

  // 3. 初始化支付方式 Payment Methods
  const existingPm = await sql`SELECT count(*)::int as count FROM payment_methods`
  if (existingPm[0].count === 0) {
    await sql`
      INSERT INTO payment_methods (name, code, icon_url, is_active, supported_locales, config_json, created_at)
      VALUES
        ('微信支付', 'wechat', 'https://api.iconify.design/ri:wechat-pay-fill.svg?color=%2307c160', true, 'zh', '{"mode":"native"}', now()),
        ('支付宝', 'alipay', 'https://api.iconify.design/ri:alipay-fill.svg?color=%231677ff', true, 'zh', '{"mode":"native"}', now()),
        ('Stripe / 信用卡', 'stripe', 'https://api.iconify.design/logos:stripe.svg', true, 'zh,en', '{"mode":"auto"}', now())
      ON CONFLICT (code) DO NOTHING;
    `
    console.log(`  ✓ 初始支付方式 (微信支付/支付宝/Stripe) 创建完成`)
  }

  // ==========================================================
  console.log('\n[4/4] 写入 AIHop 种子数据 (模型/中转站/套餐)...')

  for (const m of aihopModels) {
    await sql`
      INSERT INTO aihop_models (
        slug, name, vendor, currency, price_input, price_output,
        price_cache_read, price_cache_write, context_window, max_output_tokens,
        scores, badges, scenes, reasoning, open_weights, is_free, hidden,
        released_at, updated_at, billing, sources
      ) VALUES (
        ${m.slug}, ${m.name}, ${m.vendor}, ${m.price.currency}, ${m.price.input}, ${m.price.output},
        ${m.price.cacheRead ?? null}, ${m.price.cacheWrite ?? null}, ${m.contextWindow}, ${m.maxOutputTokens ?? null},
        ${JSON.stringify(m.scores)}, ${JSON.stringify(m.badges || [])}, ${JSON.stringify(m.scenes || [])},
        ${m.reasoning ? 1 : 0}, ${m.openWeights ? 1 : 0}, ${m.isFree ? 1 : 0}, 0,
        ${m.releasedAt ?? null}, ${m.updatedAt}, ${m.billing ? JSON.stringify(m.billing) : null},
        ${JSON.stringify(m.sources || [])}
      )
      ON CONFLICT(slug) DO UPDATE SET
        name = EXCLUDED.name,
        vendor = EXCLUDED.vendor,
        currency = EXCLUDED.currency,
        price_input = EXCLUDED.price_input,
        price_output = EXCLUDED.price_output,
        price_cache_read = EXCLUDED.price_cache_read,
        price_cache_write = EXCLUDED.price_cache_write,
        context_window = EXCLUDED.context_window,
        max_output_tokens = EXCLUDED.max_output_tokens,
        scores = EXCLUDED.scores,
        scenes = EXCLUDED.scenes,
        reasoning = EXCLUDED.reasoning,
        open_weights = EXCLUDED.open_weights,
        is_free = EXCLUDED.is_free,
        released_at = EXCLUDED.released_at,
        updated_at = EXCLUDED.updated_at,
        billing = EXCLUDED.billing,
        sources = EXCLUDED.sources;
    `
  }
  console.log(`  ✓ 20 个 AI 模型数据写入完成`)

  let gwOrder = 0
  for (const gw of aihopGateways) {
    gwOrder += 10
    await sql`
      INSERT INTO aihop_gateways (
        id, name, domain, url, models, primary_model_key, latency_ms, uptime,
        price_per_m, price_label, official_price_cny, savings_percent,
        is_self_operated, badge, badge_tone, base_url, features, caveat, hidden, sort_order
      ) VALUES (
        ${gw.id}, ${gw.name}, ${gw.domain}, ${gw.url}, ${JSON.stringify(gw.models)},
        ${gw.primaryModelKey}, ${gw.latencyMs}, ${gw.uptime}, ${gw.pricePerM},
        ${gw.priceLabel}, ${gw.officialPriceCNY}, ${gw.savingsPercent},
        ${gw.isSelfOperated ? 1 : 0}, ${gw.badge ?? null}, ${gw.badgeTone ?? null},
        ${gw.baseUrl}, ${JSON.stringify(gw.features)}, ${gw.caveat ?? ''}, 0, ${gwOrder}
      )
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        domain = EXCLUDED.domain,
        url = EXCLUDED.url,
        models = EXCLUDED.models,
        primary_model_key = EXCLUDED.primary_model_key,
        latency_ms = EXCLUDED.latency_ms,
        uptime = EXCLUDED.uptime,
        price_per_m = EXCLUDED.price_per_m,
        price_label = EXCLUDED.price_label,
        official_price_cny = EXCLUDED.official_price_cny,
        savings_percent = EXCLUDED.savings_percent,
        is_self_operated = EXCLUDED.is_self_operated,
        badge = EXCLUDED.badge,
        badge_tone = EXCLUDED.badge_tone,
        base_url = EXCLUDED.base_url,
        features = EXCLUDED.features,
        caveat = EXCLUDED.caveat,
        sort_order = EXCLUDED.sort_order;
    `
  }
  console.log(`  ✓ 7 条 AI 中转专线数据写入完成`)

  let planOrder = 0
  for (const p of aihopPlans) {
    planOrder += 10
    await sql`
      INSERT INTO aihop_coding_plans (
        slug, name, vendor, vendor_label, vendor_color, region, type,
        price_label, price_monthly_cny, payment_methods, network_requirement,
        period, quota_note, models, tools, highlights, caveats, status,
        official_url, guide_url, hidden, sort_order
      ) VALUES (
        ${p.slug}, ${p.name}, ${p.vendor}, ${p.vendorLabel}, ${p.vendorColor},
        ${p.region}, ${p.type}, ${p.priceLabel}, ${p.priceMonthlyCNY},
        ${JSON.stringify(p.paymentMethods)}, ${p.networkRequirement},
        ${p.period}, ${p.quotaNote}, ${JSON.stringify(p.models)},
        ${JSON.stringify(p.tools || [])}, ${JSON.stringify(p.highlights)},
        ${JSON.stringify(p.caveats)}, ${p.status}, ${p.officialUrl ?? null},
        ${p.guideUrl ?? null}, 0, ${planOrder}
      )
      ON CONFLICT(slug) DO UPDATE SET
        name = EXCLUDED.name,
        vendor = EXCLUDED.vendor,
        vendor_label = EXCLUDED.vendor_label,
        vendor_color = EXCLUDED.vendor_color,
        region = EXCLUDED.region,
        type = EXCLUDED.type,
        price_label = EXCLUDED.price_label,
        price_monthly_cny = EXCLUDED.price_monthly_cny,
        payment_methods = EXCLUDED.payment_methods,
        network_requirement = EXCLUDED.network_requirement,
        period = EXCLUDED.period,
        quota_note = EXCLUDED.quota_note,
        models = EXCLUDED.models,
        tools = EXCLUDED.tools,
        highlights = EXCLUDED.highlights,
        caveats = EXCLUDED.caveats,
        status = EXCLUDED.status,
        official_url = EXCLUDED.official_url,
        guide_url = EXCLUDED.guide_url,
        sort_order = EXCLUDED.sort_order;
    `
  }
  console.log(`  ✓ 10 个 AI 编程订阅套餐数据写入完成`)

  console.log(`\n======================================================`)
  console.log(`🎉 APay 整个项目与 AIHop 数据库初始化全部成功！`)
  console.log(`======================================================\n`)

  await sql.end()
}

main().catch(err => {
  console.error('✗ 初始化失败:', err)
  process.exit(1)
})
