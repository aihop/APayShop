CREATE TABLE IF NOT EXISTS "ext_apps_catalog" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "types" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "image_url" text,
  "subtitle" text NOT NULL DEFAULT '',
  "price_amount" bigint NOT NULL DEFAULT 0,
  "content" text NOT NULL DEFAULT '',
  "downs" integer NOT NULL DEFAULT 0,
  "status" smallint NOT NULL DEFAULT 10,
  "unique_name" text NOT NULL UNIQUE,
  "package_url" text NOT NULL,
  "version" text NOT NULL,
  "installs_json" text NOT NULL DEFAULT '[]',
  "settings_json" text NOT NULL DEFAULT '{}',
  "seo_title" text NOT NULL DEFAULT '',
  "seo_keywords" text NOT NULL DEFAULT '',
  "seo_description" text NOT NULL DEFAULT '',
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  CHECK ("types" IN ('theme', 'plugin')),
  CHECK ("status" IN (10, 20)),
  CHECK ("price_amount" >= 0),
  CHECK ("downs" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ext_apps_catalog_status_updated_idx" ON "ext_apps_catalog" ("status", "updated_at");
