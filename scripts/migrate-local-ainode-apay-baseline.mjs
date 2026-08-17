import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const BASELINE_TAG = '0018_add_order_source_idempotency'
const BASELINE_CREATED_AT = 1785300007000
const LEGACY_PRODUCTS_TABLE = 'ainode_products_legacy_20260817'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

const fail = (message) => {
  throw new Error(message)
}

const connectionString = String(process.env.DATABASE_URL || '').replaceAll('"', '').trim()
if (!connectionString) fail('DATABASE_URL is required')

const connectionUrl = new URL(connectionString)
if (!LOCAL_HOSTS.has(connectionUrl.hostname)) {
  fail(`Refusing non-local PostgreSQL host: ${connectionUrl.hostname}`)
}
if (decodeURIComponent(connectionUrl.pathname.replace(/^\//, '')) !== 'ainode') {
  fail('Refusing database other than local ainode')
}
if (!process.argv.includes('--apply')) {
  fail('This migration changes the local database. Re-run with --apply after reviewing the script.')
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '..')
const baselineSql = readFileSync(
  resolve(repositoryRoot, `server/db/migrations/pg/${BASELINE_TAG}.sql`),
  'utf8',
)
const baselineHash = createHash('sha256').update(baselineSql).digest('hex')
const client = new pg.Client({ connectionString })

const relationExists = async (qualifiedName) => {
  const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [qualifiedName])
  return result.rows[0].exists
}

const tableColumns = async (tableName) => {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [tableName],
  )
  return new Set(result.rows.map(row => row.column_name))
}

const renameConstraintIfPresent = async (tableName, oldName, newName) => {
  const result = await client.query(
    `SELECT 1
       FROM pg_constraint
      WHERE conrelid = $1::regclass AND conname = $2`,
    [`public.${tableName}`, oldName],
  )
  if (result.rowCount > 0) {
    await client.query(`ALTER TABLE public.${tableName} RENAME CONSTRAINT ${oldName} TO ${newName}`)
  }
}

const renameIndexIfPresent = async (oldName, newName) => {
  if (await relationExists(`public.${oldName}`)) {
    if (await relationExists(`public.${newName}`)) fail(`Both ${oldName} and ${newName} exist`)
    await client.query(`ALTER INDEX public.${oldName} RENAME TO ${newName}`)
  }
}

const renameSequenceIfPresent = async (oldName, newName) => {
  if (await relationExists(`public.${oldName}`)) {
    if (await relationExists(`public.${newName}`)) fail(`Both ${oldName} and ${newName} exist`)
    await client.query(`ALTER SEQUENCE public.${oldName} RENAME TO ${newName}`)
  }
}

const ensureAinodeProductsPreserved = async () => {
  if (!(await relationExists('public.products'))) return { source: 0, copied: 0, renamed: false }

  const columns = await tableColumns('products')
  const isAinodeProducts = ['channel', 'origin_id', 'source_url', 'title', 'model_name', 'data']
    .every(column => columns.has(column))
  const isApayProducts = ['slug', 'name', 'type', 'is_active', 'meta_data']
    .every(column => columns.has(column))

  if (isApayProducts) return { source: 0, copied: 0, renamed: false }
  if (!isAinodeProducts) fail('public.products matches neither the ainode nor APay schema')
  if (await relationExists(`public.${LEGACY_PRODUCTS_TABLE}`)) {
    fail(`Both public.products and public.${LEGACY_PRODUCTS_TABLE} exist; manual reconciliation required`)
  }
  if (!(await relationExists('public.crawl_products'))) {
    fail('public.crawl_products is required before preserving ainode products')
  }

  const sourceResult = await client.query('SELECT count(*)::bigint AS count FROM public.products')
  await client.query(`
    INSERT INTO public.crawl_products (
      channel, origin_id, source_url, title, price, currency,
      main_image, model_name, data, created_at, updated_at
    )
    SELECT
      channel, origin_id, source_url, title, price, currency,
      main_image, model_name, data, created_at, updated_at
    FROM public.products
    ON CONFLICT (channel, origin_id) DO NOTHING
  `)
  const copiedResult = await client.query(`
    SELECT count(*)::bigint AS count
      FROM public.products source
     WHERE EXISTS (
       SELECT 1 FROM public.crawl_products target
        WHERE target.channel = source.channel AND target.origin_id = source.origin_id
     )
  `)
  if (copiedResult.rows[0].count !== sourceResult.rows[0].count) {
    fail('Not every ainode product was preserved in public.crawl_products')
  }

  await renameConstraintIfPresent('products', 'products_pkey', 'ainode_products_legacy_20260817_pkey')
  await renameConstraintIfPresent(
    'products',
    'products_channel_origin_id_key',
    'ainode_products_legacy_20260817_channel_origin_key',
  )
  await renameIndexIfPresent('idx_products_updated_at', 'idx_ainode_products_legacy_20260817_updated_at')
  await client.query(`ALTER TABLE public.products RENAME TO ${LEGACY_PRODUCTS_TABLE}`)
  await renameSequenceIfPresent('products_id_seq', 'ainode_products_legacy_20260817_id_seq')

  return {
    source: Number(sourceResult.rows[0].count),
    copied: Number(copiedResult.rows[0].count),
    renamed: true,
  }
}

const ensureSharedTables = async () => {
  await client.query(`
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_session_id text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone;
    ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
    UPDATE public.users SET created_at = now() WHERE created_at IS NULL;
    ALTER TABLE public.users ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE public.users ALTER COLUMN created_at SET NOT NULL;

    CREATE TABLE IF NOT EXISTS public.admins (
      id serial PRIMARY KEY NOT NULL,
      username text NOT NULL,
      password_hash text NOT NULL,
      permissions jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT admins_username_unique UNIQUE(username)
    );
    ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS permissions jsonb;

    CREATE TABLE IF NOT EXISTS public.admin_tokens (
      id serial PRIMARY KEY NOT NULL,
      admin_id integer NOT NULL,
      token text NOT NULL,
      name text,
      permissions jsonb,
      expires_at timestamp with time zone,
      last_used_at timestamp with time zone,
      revoked boolean DEFAULT false NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT admin_tokens_token_unique UNIQUE(token)
    );

    CREATE TABLE IF NOT EXISTS public.access_logs (
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
      user_id integer,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE public.balance_logs ADD COLUMN IF NOT EXISTS event_id text;
    ALTER TABLE public.balance_logs ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'system' NOT NULL;
    ALTER TABLE public.balance_logs ADD COLUMN IF NOT EXISTS source_id text;
    CREATE UNIQUE INDEX IF NOT EXISTS balance_logs_event_id_unique
      ON public.balance_logs (event_id);
    CREATE INDEX IF NOT EXISTS idx_balance_logs_user_created_at
      ON public.balance_logs (user_id, created_at DESC);
  `)

  await client.query(`
    DO $$ BEGIN
      ALTER TABLE public.admin_tokens
        ADD CONSTRAINT admin_tokens_admin_id_admins_id_fk
        FOREIGN KEY (admin_id) REFERENCES public.admins(id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE public.access_logs
        ADD CONSTRAINT access_logs_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES public.users(id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

const ensureApayTables = async () => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.products (
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

    CREATE TABLE IF NOT EXISTS public.users_tokens (
      id serial PRIMARY KEY NOT NULL,
      user_id integer NOT NULL REFERENCES public.users(id),
      token text NOT NULL,
      name text,
      expires_at timestamp with time zone,
      last_used_at timestamp with time zone,
      revoked boolean DEFAULT false NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT users_tokens_token_unique UNIQUE(token)
    );

    CREATE TABLE IF NOT EXISTS public.oauth_accounts (
      id serial PRIMARY KEY NOT NULL,
      user_id integer NOT NULL REFERENCES public.users(id),
      provider text NOT NULL,
      provider_account_id text NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS provider_account_idx
      ON public.oauth_accounts (provider, provider_account_id);

    CREATE TABLE IF NOT EXISTS public.cards (
      id serial PRIMARY KEY NOT NULL,
      product_id integer NOT NULL REFERENCES public.products(id),
      card_number text NOT NULL,
      is_used boolean DEFAULT false NOT NULL,
      order_id text,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.payment_methods (
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
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.email_providers (
      id serial PRIMARY KEY NOT NULL,
      name text NOT NULL,
      code text NOT NULL,
      is_active boolean DEFAULT false NOT NULL,
      config_json text,
      send_script text,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.orders (
      id text PRIMARY KEY NOT NULL,
      amount real NOT NULL,
      currency text DEFAULT 'USD' NOT NULL,
      source text,
      external_order_id text,
      product_id integer NOT NULL REFERENCES public.products(id),
      user_id integer REFERENCES public.users(id),
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
    CREATE UNIQUE INDEX IF NOT EXISTS orders_source_external_order_unique
      ON public.orders (source, external_order_id);

    CREATE TABLE IF NOT EXISTS public.subscriptions (
      id text PRIMARY KEY NOT NULL,
      gateway_sub_id text,
      user_id integer REFERENCES public.users(id),
      product_id integer NOT NULL REFERENCES public.products(id),
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

    CREATE TABLE IF NOT EXISTS public.settings (
      key text PRIMARY KEY NOT NULL,
      value text NOT NULL,
      description text,
      updated_at timestamp with time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.payment_failures (
      id serial PRIMARY KEY NOT NULL,
      order_id text NOT NULL,
      card_bin text,
      reason text NOT NULL,
      amount real,
      pay_method text,
      contact_email text,
      raw_response text,
      visitor_id text,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.webhooks (
      id serial PRIMARY KEY NOT NULL,
      name text NOT NULL,
      url text NOT NULL,
      events jsonb,
      secret text,
      is_active boolean DEFAULT true NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.event_rules (
      id serial PRIMARY KEY NOT NULL,
      event text NOT NULL,
      action text NOT NULL,
      config jsonb,
      enabled boolean DEFAULT true NOT NULL,
      remark text,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.logs (
      id serial PRIMARY KEY NOT NULL,
      level text DEFAULT 'info' NOT NULL,
      message text NOT NULL,
      details text,
      source text,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.visitor_profiles (
      visitor_id text PRIMARY KEY NOT NULL,
      user_id integer REFERENCES public.users(id),
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

    CREATE TABLE IF NOT EXISTS public.visitor_events (
      id serial PRIMARY KEY NOT NULL,
      visitor_id text NOT NULL,
      ip text,
      user_id integer REFERENCES public.users(id),
      order_id text REFERENCES public.orders(id),
      product_id integer REFERENCES public.products(id),
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

    CREATE TABLE IF NOT EXISTS public.operation_logs (
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
    CREATE INDEX IF NOT EXISTS operation_logs_created_at_idx ON public.operation_logs (created_at);
    CREATE INDEX IF NOT EXISTS operation_logs_actor_idx ON public.operation_logs (actor_id, created_at);
    CREATE INDEX IF NOT EXISTS operation_logs_resource_idx ON public.operation_logs (resource, resource_id);

    CREATE TABLE IF NOT EXISTS public.posts (
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

    CREATE TABLE IF NOT EXISTS public.notifications (
      id serial PRIMARY KEY NOT NULL,
      user_id integer REFERENCES public.users(id),
      visitor_id text,
      type text NOT NULL,
      title text NOT NULL,
      message text NOT NULL,
      data jsonb,
      is_read boolean DEFAULT false NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.promo_agent_tiers (
      id serial PRIMARY KEY NOT NULL,
      code text NOT NULL,
      name text NOT NULL,
      role_scope text DEFAULT 'agent' NOT NULL,
      level integer DEFAULT 1 NOT NULL,
      discount_rate real DEFAULT 1 NOT NULL,
      sales_threshold real DEFAULT 0 NOT NULL,
      is_fixed boolean DEFAULT false NOT NULL,
      is_active boolean DEFAULT true NOT NULL,
      description text,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now(),
      CONSTRAINT promo_agent_tiers_code_unique UNIQUE(code)
    );

    CREATE TABLE IF NOT EXISTS public.promo_members (
      id serial PRIMARY KEY NOT NULL,
      user_id integer NOT NULL REFERENCES public.users(id),
      role text DEFAULT 'member' NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      promo_code text NOT NULL,
      invite_code text NOT NULL,
      agent_code text,
      current_agent_tier_id integer REFERENCES public.promo_agent_tiers(id),
      joined_at timestamp with time zone DEFAULT now() NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT promo_members_user_id_unique UNIQUE(user_id),
      CONSTRAINT promo_members_promo_code_unique UNIQUE(promo_code),
      CONSTRAINT promo_members_invite_code_unique UNIQUE(invite_code),
      CONSTRAINT promo_members_agent_code_unique UNIQUE(agent_code)
    );

    CREATE TABLE IF NOT EXISTS public.promo_invite_relations (
      id serial PRIMARY KEY NOT NULL,
      invitee_user_id integer NOT NULL REFERENCES public.users(id),
      inviter_user_id integer NOT NULL REFERENCES public.users(id),
      source text DEFAULT 'register' NOT NULL,
      code_snapshot text,
      bound_at timestamp with time zone DEFAULT now() NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT promo_invite_relations_invitee_user_id_unique UNIQUE(invitee_user_id)
    );

    CREATE TABLE IF NOT EXISTS public.promo_agent_relations (
      id serial PRIMARY KEY NOT NULL,
      agent_user_id integer NOT NULL REFERENCES public.users(id),
      parent_agent_user_id integer REFERENCES public.users(id),
      master_agent_user_id integer REFERENCES public.users(id),
      depth integer DEFAULT 1 NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      bound_at timestamp with time zone DEFAULT now() NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT promo_agent_relations_agent_user_id_unique UNIQUE(agent_user_id)
    );

    CREATE TABLE IF NOT EXISTS public.promo_order_attributions (
      id serial PRIMARY KEY NOT NULL,
      order_id text NOT NULL REFERENCES public.orders(id),
      buyer_user_id integer REFERENCES public.users(id),
      buyer_promo_member_id integer REFERENCES public.promo_members(id),
      invite_user_id integer REFERENCES public.users(id),
      agent_user_id integer REFERENCES public.users(id),
      parent_agent_user_id integer REFERENCES public.users(id),
      master_agent_user_id integer REFERENCES public.users(id),
      agent_tier_id_snapshot integer,
      agent_tier_name_snapshot text,
      discount_rate_snapshot real,
      source_type text DEFAULT 'direct' NOT NULL,
      meta_data jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT promo_order_attributions_order_id_unique UNIQUE(order_id)
    );

    CREATE TABLE IF NOT EXISTS public.promo_commissions (
      id serial PRIMARY KEY NOT NULL,
      order_id text NOT NULL REFERENCES public.orders(id),
      owner_user_id integer NOT NULL REFERENCES public.users(id),
      owner_promo_member_id integer REFERENCES public.promo_members(id),
      type text NOT NULL,
      source_type text DEFAULT 'direct' NOT NULL,
      amount real NOT NULL,
      rate real,
      status text DEFAULT 'pending' NOT NULL,
      remark text,
      meta_data jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS promo_commissions_order_type_idx
      ON public.promo_commissions (order_id, type);
  `)
}

const verifySchema = async (productMigration) => {
  const expectedTables = [
    'users', 'users_tokens', 'admins', 'admin_tokens', 'oauth_accounts', 'products', 'cards',
    'payment_methods', 'email_providers', 'orders', 'subscriptions', 'settings', 'payment_failures',
    'webhooks', 'event_rules', 'logs', 'visitor_profiles', 'visitor_events', 'access_logs',
    'operation_logs', 'posts', 'notifications', 'balance_logs', 'promo_agent_tiers', 'promo_members',
    'promo_invite_relations', 'promo_agent_relations', 'promo_order_attributions', 'promo_commissions',
  ]
  const tablesResult = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [expectedTables],
  )
  const presentTables = new Set(tablesResult.rows.map(row => row.table_name))
  const missingTables = expectedTables.filter(tableName => !presentTables.has(tableName))
  if (missingTables.length > 0) fail(`Missing APay tables: ${missingTables.join(', ')}`)

  const requiredColumns = {
    users: ['current_session_id', 'email_verified_at', 'cash_balance', 'grant_balance', 'sub_balance'],
    products: ['slug', 'name', 'price', 'type', 'meta_data', 'is_active'],
    orders: ['currency', 'source', 'external_order_id', 'product_id', 'pay_status'],
    balance_logs: ['event_id', 'source_type', 'source_id', 'transaction_id', 'wallet_id'],
    visitor_profiles: ['ip'],
  }
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    const actualColumns = await tableColumns(tableName)
    const missingColumns = columns.filter(column => !actualColumns.has(column))
    if (missingColumns.length > 0) fail(`Missing ${tableName} columns: ${missingColumns.join(', ')}`)
  }

  for (const indexName of [
    'orders_source_external_order_unique',
    'balance_logs_event_id_unique',
    'promo_commissions_order_type_idx',
  ]) {
    if (!(await relationExists(`public.${indexName}`))) fail(`Missing index: ${indexName}`)
  }

  if (productMigration.renamed) {
    if (!(await relationExists(`public.${LEGACY_PRODUCTS_TABLE}`))) fail('Legacy ainode products table is missing')
    const sourceResult = await client.query(`SELECT count(*)::bigint AS count FROM public.${LEGACY_PRODUCTS_TABLE}`)
    const copiedResult = await client.query(`
      SELECT count(*)::bigint AS count
        FROM public.${LEGACY_PRODUCTS_TABLE} source
       WHERE EXISTS (
         SELECT 1 FROM public.crawl_products target
          WHERE target.channel = source.channel AND target.origin_id = source.origin_id
       )
    `)
    if (sourceResult.rows[0].count !== copiedResult.rows[0].count) {
      fail('Legacy ainode products are not fully represented in crawl_products')
    }
  }

  return { tableCount: expectedTables.length }
}

const writeBaseline = async () => {
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle')
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)
  const futureResult = await client.query(
    'SELECT created_at FROM drizzle.__drizzle_migrations WHERE created_at > $1 LIMIT 1',
    [BASELINE_CREATED_AT],
  )
  if (futureResult.rowCount > 0) fail('Drizzle ledger already contains a migration newer than the baseline')
  await client.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
     SELECT $1, $2
     WHERE NOT EXISTS (
       SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = $2
     )`,
    [baselineHash, BASELINE_CREATED_AT],
  )
}

let transactionStarted = false
try {
  await client.connect()
  const identityResult = await client.query(
    'SELECT current_database() AS database, current_user AS user, inet_server_addr()::text AS host',
  )
  const identity = identityResult.rows[0]
  if (identity.database !== 'ainode') fail(`Connected to unexpected database: ${identity.database}`)

  await client.query('BEGIN')
  transactionStarted = true
  await client.query("SET LOCAL lock_timeout = '5s'")
  await client.query("SET LOCAL statement_timeout = '60s'")
  await client.query("SELECT pg_advisory_xact_lock(hashtext('apay-local-ainode-baseline-v1'))")

  const productMigration = await ensureAinodeProductsPreserved()
  await ensureSharedTables()
  await ensureApayTables()
  const verification = await verifySchema(productMigration)
  await writeBaseline()

  await client.query('COMMIT')
  transactionStarted = false
  console.log(JSON.stringify({
    ok: true,
    database: identity.database,
    host: identity.host,
    legacyProductsTable: productMigration.renamed ? LEGACY_PRODUCTS_TABLE : null,
    ainodeProducts: productMigration,
    verifiedApayTables: verification.tableCount,
    baseline: { tag: BASELINE_TAG, createdAt: BASELINE_CREATED_AT, hash: baselineHash },
    rollbackBoundary: 'The migration committed as one transaction; failures before COMMIT roll back the complete migration.',
  }, null, 2))
} catch (error) {
  if (transactionStarted) await client.query('ROLLBACK').catch(() => {})
  console.error(JSON.stringify({
    ok: false,
    message: error instanceof Error ? error.message : String(error),
    code: error?.code,
    rollback: transactionStarted ? 'ROLLBACK attempted for the complete migration transaction' : 'No active transaction',
  }, null, 2))
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
