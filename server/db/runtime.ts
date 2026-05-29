import postgres from 'postgres'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import { createClient } from '@libsql/client'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import mysql from 'mysql2/promise'
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2'
import * as schema from './schema'

const normalizeEnv = (value?: string) => (value || '').replace(/"/g, '').trim()

const getConnectionUrl = () => normalizeEnv(
  process.env.DATABASE_URL
  || process.env.MYSQL_URL
  || process.env.POSTGRES_URL
  || process.env.POSTGRESQL_URL
  || process.env.NUXT_DATABASE_URL
  || process.env.LIBSQL_URL
  || ''
)

const resolveDialect = () => {
  const explicitDialect = normalizeEnv(process.env.DB_DIALECT).toLowerCase()
  if (explicitDialect === 'postgresql' || explicitDialect === 'sqlite' || explicitDialect === 'mysql') return explicitDialect

  const connectionUrl = getConnectionUrl()
  if (connectionUrl.startsWith('postgres://') || connectionUrl.startsWith('postgresql://')) {
    return 'postgresql'
  }
  if (connectionUrl.startsWith('mysql://')) {
    return 'mysql'
  }
  return 'sqlite'
}

const createDb = () => {
  const dialect = resolveDialect()
  const connectionUrl = getConnectionUrl()

  if (dialect === 'mysql' && connectionUrl) {
    const poolConnection = mysql.createPool(connectionUrl)
    return drizzleMysql(poolConnection, { schema, mode: 'default' } as any)
  }

  if (dialect === 'mysql' && !connectionUrl) {
    throw new Error('DB_DIALECT=mysql but no MYSQL_URL/DATABASE_URL provided.')
  }

  if (dialect === 'postgresql' && connectionUrl) {
    const client = postgres(connectionUrl, { prepare: false })
    return drizzlePostgres(client, { schema } as any)
  }

  if (dialect === 'postgresql' && !connectionUrl) {
    const allowFallback = normalizeEnv(process.env.DB_FALLBACK_TO_SQLITE).toLowerCase() === 'true'
    if (!allowFallback) {
      throw new Error('DB_DIALECT=postgresql but no DATABASE_URL/POSTGRES_URL/POSTGRESQL_URL/NUXT_DATABASE_URL provided.')
    }
  }

  const url = normalizeEnv(process.env.LIBSQL_URL) || 'file:./.data/db/sqlite.db'
  const client = createClient({ url })
  return drizzleLibsql(client, { schema } as any)
}

export const db = createDb() as any
export { schema }
