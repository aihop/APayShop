import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.pg.ts',
  out: './server/db/migrations/pg', // 指向 PG 文件夹
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["public"],
  tablesFilter: ["users", "posts","admins","api_keys","cards","failures","logs","oauth_accounts","orders","payment_methods","products","settings","theme_settings","webhooks","subscriptions","visitor_profiles","visitor_events","_hub_migrations"],
  push: {
    force: true
  }
});
