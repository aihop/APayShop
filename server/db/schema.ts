import * as pgSchema from './schema.pg'
import * as sqliteSchema from './schema.sqlite'

const resolveDialect = () => {
  const explicitDialect = process.env.DB_DIALECT?.replace(/"/g, '').toLowerCase()

  if (explicitDialect === 'postgresql' || explicitDialect === 'sqlite') {
    return explicitDialect
  }

  const connectionUrl =
    process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRESQL_URL
    || process.env.NUXT_DATABASE_URL
    || process.env.LIBSQL_URL
    || ''

  if (connectionUrl.startsWith('postgres://') || connectionUrl.startsWith('postgresql://')) {
    return 'postgresql'
  }

  return 'sqlite'
}

const activeSchema = (resolveDialect() === 'postgresql' ? pgSchema : sqliteSchema) as typeof pgSchema & typeof sqliteSchema

export const {
  users,
  admins,
  oauthAccounts,
  products,
  cards,
  paymentMethods,
  orders,
  settings,
  themeSettings,
  apiKeys,
  failures,
  webhooks,
  logs,
  visitorProfiles,
  visitorEvents,
  posts,
  subscriptions
} = activeSchema
