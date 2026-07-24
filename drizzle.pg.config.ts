import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.pg.ts',
  out: './server/db/migrations/pg', // 指向 PG 文件夹
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["public"],
  tablesFilter: [
    "users",
    "users_tokens",
    "posts",
    "admins",
    "cards",
    "payment_failures",
    "logs",
    "install_events",
    "oauth_accounts",
    "orders",
    "payment_methods",
    "products",
    "settings",
    "theme_settings",
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
