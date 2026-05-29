import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'mysql',
  schema: './server/db/schema.mysql.ts',
  out: './server/db/migrations/mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.MYSQL_URL || '',
  },
  tablesFilter: ["users", "posts","admins","api_keys","cards","failures","logs","install_events","oauth_accounts","orders","payment_methods","products","settings","theme_settings","webhooks","subscriptions","visitor_profiles","visitor_events","_hub_migrations"],
  push: {
    force: true
  }
} as any);
