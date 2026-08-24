CREATE TABLE IF NOT EXISTS `ext_theme_catalog` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `category` text NOT NULL DEFAULT '',
  `slug` text NOT NULL UNIQUE,
  `image_url` text,
  `subtitle` text NOT NULL DEFAULT '',
  `price_amount` integer NOT NULL DEFAULT 0,
  `content` text NOT NULL DEFAULT '',
  `downs` integer NOT NULL DEFAULT 0,
  `status` integer NOT NULL DEFAULT 10,
  `unique_name` text NOT NULL UNIQUE,
  `package_url` text,
  `demo_url` text,
  `settings_json` text NOT NULL DEFAULT '{}',
  `seo_title` text NOT NULL DEFAULT '',
  `seo_keywords` text NOT NULL DEFAULT '',
  `seo_description` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  CHECK (`status` IN (10, 20)),
  CHECK (`price_amount` >= 0),
  CHECK (`downs` >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ext_theme_catalog_status_updated_idx` ON `ext_theme_catalog` (`status`, `updated_at`);
