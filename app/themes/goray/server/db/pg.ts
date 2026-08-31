import postgres from 'postgres'

const normalizeEnv = (value?: string) => (value || '').replace(/"/g, '').trim()

const resolveConnectionString = () => normalizeEnv(
  process.env.GORAY_DATABASE_URL
  || process.env.DATABASE_URL
  || process.env.POSTGRES_URL
)

export type GoraySqlClient = ReturnType<typeof postgres>
export type GorayQueryClient = postgres.Sql | postgres.TransactionSql

const globalScope = globalThis as typeof globalThis & {
  __goraySql?: GoraySqlClient
}

export const getGoraySql = (): GoraySqlClient => {
  if (globalScope.__goraySql) {
    return globalScope.__goraySql
  }

  const connectionString = resolveConnectionString()
  if (!connectionString) {
    throw new Error('Missing GORAY_DATABASE_URL or DATABASE_URL for goray theme database module.')
  }

  globalScope.__goraySql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  return globalScope.__goraySql
}

export const goraySql = new Proxy((() => {}) as any, {
  apply(_target, thisArg, argArray) {
    return Reflect.apply(getGoraySql() as any, thisArg, argArray)
  },
  get(_target, prop, receiver) {
    return Reflect.get(getGoraySql() as any, prop, receiver)
  },
}) as GoraySqlClient

const REQUIRED_TABLES = [
  'goray_schema_migrations',
  'goray_entitlements',
  'goray_device_authorizations',
  'goray_devices',
  'goray_refresh_tokens',
  'goray_nodes',
  'goray_node_health_samples',
  'goray_traffic_reports',
  'goray_traffic_daily_totals',
  'goray_redeem_batches',
  'goray_redeem_codes',
  'goray_apay_events',
  'goray_reconcile_state',
  'goray_idempotency_records',
  'goray_deletion_tombstones',
  'goray_deletion_jobs',
  'goray_releases',
  'goray_resource_manifests',
  'goray_audit_logs',
] as const

let schemaCheck: Promise<void> | null = null

export const assertGoraySchemaReady = async (): Promise<void> => {
  schemaCheck ||= (async () => {
    const tableRows = await getGoraySql()<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema() AND tablename = ANY(${[...REQUIRED_TABLES] as string[]})
    `
    const present = new Set(tableRows.map(r => r.tablename))
    const missing = REQUIRED_TABLES.filter(t => !present.has(t))

    if (missing.length > 0) {
      throw new Error(
        `[goray] 数据库表结构未就绪，缺少数据表: ${missing.join(', ')}\n` +
        '  请先执行: node app/themes/goray/scripts/apply-goray-sql.mjs'
      )
    }
  })().catch((err) => {
    schemaCheck = null
    throw err
  })

  return schemaCheck
}
