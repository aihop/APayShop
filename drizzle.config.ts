import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./server/db/schema.sqlite.ts",
  out: "./server/db/migrations/sqlite",
  dbCredentials: {
    url: "file:./.data/db/sqlite.db" // local dev default
  },
  schemaFilter: ["public"],
  tablesFilter: ["users", "posts","admins","api_keys","cards","failures","logs","oauth_accounts","orders","payment_methods","products","settings","theme_settings","webhooks","subscriptions","visitor_profiles","visitor_events"],
  push: {
    force: true
  }
});
