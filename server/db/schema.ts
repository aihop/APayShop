import * as pgSchema from './schema.pg'
import * as sqliteSchema from './schema.sqlite'
import * as mysqlSchema from './schema.mysql'

const resolveDialect = () => {
  const explicitDialect = process.env.DB_DIALECT?.replace(/"/g, '').toLowerCase()

  if (explicitDialect === 'postgresql' || explicitDialect === 'sqlite' || explicitDialect === 'mysql') {
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

  if (connectionUrl.startsWith('mysql://')) {
    return 'mysql'
  }

  return 'sqlite'
}

const resolveSchema = () => {
  const dialect = resolveDialect()
  if (dialect === 'postgresql') return pgSchema
  if (dialect === 'mysql') return mysqlSchema
  return sqliteSchema
}

const activeSchema = resolveSchema() as typeof pgSchema & typeof sqliteSchema & typeof mysqlSchema

export const {
  users,
  usersTokens,
  admins,
  oauthAccounts,
  products,
  cards,
  paymentMethods,
  emailProviders,
  orders,
  settings,
  themeSettings,
  paymentFailures,
  failures,
  webhooks,
  eventRules,
  logs,
  visitorProfiles,
  visitorEvents,
  accessLogs,
  posts,
  subscriptions,
  notifications,
  promoMembers,
  promoInviteRelations,
  promoAgentRelations,
  promoAgentTiers,
  promoOrderAttributions,
  promoCommissions
} = activeSchema
