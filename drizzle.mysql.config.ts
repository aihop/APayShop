import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'mysql',
  schema: './server/db/schema.mysql.ts',
  out: './server/db/migrations/mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.MYSQL_URL || '',
  },
  tablesFilter: [
    "users",
    "user_sessions",
    "user_tokens",
    "posts",
    "admins",
    "admin_tokens",
    "cards",
    "payment_failures",
    "logs",
    "install_events",
    "oauth_accounts",
    "orders",
    "payment_methods",
    "products",
    "settings",
    "webhooks",
    "subscriptions",
    "visitor_profiles",
    "visitor_events",
    "access_logs",
    "email_providers",
    "event_rules",
    "notifications",
    "promo_agent_tiers",
    "promo_members",
    "promo_invite_relations",
    "promo_agent_relations",
    "promo_order_attributions",
    "promo_commissions",
    "_hub_migrations"
  ],
  push: {
    force: true
  }
} as any);
