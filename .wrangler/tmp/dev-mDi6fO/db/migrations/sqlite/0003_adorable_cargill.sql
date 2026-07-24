CREATE TABLE `access_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`method` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`referrer` text,
	`country` text,
	`region` text,
	`city` text,
	`status_code` integer,
	`duration` real,
	`visitor_id` text,
	`user_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `email_providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`config_json` text,
	`send_script` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visitor_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_id` text NOT NULL,
	`ip` text,
	`user_id` integer,
	`order_id` text,
	`product_id` integer,
	`event_name` text NOT NULL,
	`event_action` text,
	`path` text,
	`referrer` text,
	`source_type` text,
	`source` text,
	`medium` text,
	`campaign` text,
	`content` text,
	`term` text,
	`country` text,
	`region` text,
	`city` text,
	`locale` text,
	`currency` text,
	`device_type` text,
	`browser` text,
	`os` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visitor_profiles` (
	`visitor_id` text PRIMARY KEY NOT NULL,
	`user_id` integer,
	`first_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`landing_path` text,
	`first_path` text,
	`last_path` text,
	`first_referrer` text,
	`last_referrer` text,
	`first_source_type` text,
	`last_source_type` text,
	`first_source` text,
	`last_source` text,
	`first_medium` text,
	`last_medium` text,
	`first_campaign` text,
	`last_campaign` text,
	`first_content` text,
	`last_content` text,
	`first_term` text,
	`last_term` text,
	`country` text,
	`region` text,
	`city` text,
	`locale` text,
	`currency` text,
	`device_type` text,
	`browser` text,
	`os` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_admins`("id", "username", "password_hash", "created_at") SELECT "id", "username", "password_hash", "created_at" FROM `admins`;--> statement-breakpoint
DROP TABLE `admins`;--> statement-breakpoint
ALTER TABLE `__new_admins` RENAME TO `admins`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `admins_username_unique` ON `admins` (`username`);--> statement-breakpoint
CREATE TABLE `__new_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`card_number` text NOT NULL,
	`is_used` integer DEFAULT false NOT NULL,
	`order_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_cards`("id", "product_id", "card_number", "is_used", "order_id", "created_at") SELECT "id", "product_id", "card_number", "is_used", "order_id", "created_at" FROM `cards`;--> statement-breakpoint
DROP TABLE `cards`;--> statement-breakpoint
ALTER TABLE `__new_cards` RENAME TO `cards`;--> statement-breakpoint
CREATE TABLE `__new_failures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`card_bin` text,
	`reason` text NOT NULL,
	`amount` real,
	`pay_method` text,
	`contact_email` text,
	`raw_response` text,
	`visitor_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_failures`("id", "order_id", "card_bin", "reason", "amount", "pay_method", "contact_email", "raw_response", "visitor_id", "created_at") SELECT "id", "order_id", "card_bin", "reason", "amount", "pay_method", "contact_email", "raw_response", "visitor_id", "created_at" FROM `failures`;--> statement-breakpoint
DROP TABLE `failures`;--> statement-breakpoint
ALTER TABLE `__new_failures` RENAME TO `failures`;--> statement-breakpoint
CREATE TABLE `__new_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`source` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_logs`("id", "level", "message", "details", "source", "created_at") SELECT "id", "level", "message", "details", "source", "created_at" FROM `logs`;--> statement-breakpoint
DROP TABLE `logs`;--> statement-breakpoint
ALTER TABLE `__new_logs` RENAME TO `logs`;--> statement-breakpoint
CREATE TABLE `__new_oauth_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_oauth_accounts`("id", "user_id", "provider", "provider_account_id", "created_at") SELECT "id", "user_id", "provider", "provider_account_id", "created_at" FROM `oauth_accounts`;--> statement-breakpoint
DROP TABLE `oauth_accounts`;--> statement-breakpoint
ALTER TABLE `__new_oauth_accounts` RENAME TO `oauth_accounts`;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`amount` real NOT NULL,
	`product_id` integer NOT NULL,
	`user_id` integer,
	`contact_email` text NOT NULL,
	`pay_method` text,
	`trade_no` text,
	`status` text DEFAULT 'none' NOT NULL,
	`delivery_info` text,
	`meta_data` text,
	`visitor_id` text,
	`subscription_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`paid_at` integer,
	`pay_status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "amount", "product_id", "user_id", "contact_email", "pay_method", "trade_no", "status", "delivery_info", "meta_data", "visitor_id", "subscription_id", "created_at", "paid_at", "pay_status") SELECT "id", "amount", "product_id", "user_id", "contact_email", "pay_method", "trade_no", "status", "delivery_info", "meta_data", "visitor_id", "subscription_id", "created_at", "paid_at", "pay_status" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
CREATE TABLE `__new_payment_methods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`icon_url` text,
	`is_active` integer DEFAULT false NOT NULL,
	`config_json` text,
	`info` text,
	`create` text,
	`callback` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_payment_methods`("id", "name", "code", "icon_url", "is_active", "config_json", "info", "create", "callback", "created_at") SELECT "id", "name", "code", "icon_url", "is_active", "config_json", "info", "create", "callback", "created_at" FROM `payment_methods`;--> statement-breakpoint
DROP TABLE `payment_methods`;--> statement-breakpoint
ALTER TABLE `__new_payment_methods` RENAME TO `payment_methods`;--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text,
	`sort` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`content` text,
	`type` text DEFAULT 'blog' NOT NULL,
	`image_url` text,
	`views` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`meta_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
INSERT INTO `__new_posts`("id", "key", "sort", "slug", "title", "description", "content", "type", "image_url", "views", "is_active", "meta_data", "created_at", "updated_at") SELECT "id", "key", "sort", "slug", "title", "description", "content", "type", "image_url", "views", "is_active", "meta_data", "created_at", "updated_at" FROM `posts`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`description` text,
	`content` text,
	`type` text NOT NULL,
	`image_url` text,
	`views` integer DEFAULT 0 NOT NULL,
	`image_urls` text,
	`resource` text,
	`is_active` integer DEFAULT true NOT NULL,
	`meta_data` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "slug", "name", "price", "description", "content", "type", "image_url", "views", "image_urls", "resource", "is_active", "meta_data", "sort_order", "created_at") SELECT "id", "slug", "name", "price", "description", "content", "type", "image_url", "views", "image_urls", "resource", "is_active", "meta_data", "sort_order", "created_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`gateway_sub_id` text,
	`user_id` integer,
	`product_id` integer NOT NULL,
	`pay_method` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`interval` text NOT NULL,
	`interval_count` integer DEFAULT 1 NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`current_period_start` integer,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false,
	`meta_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_subscriptions`("id", "gateway_sub_id", "user_id", "product_id", "pay_method", "status", "interval", "interval_count", "amount", "currency", "current_period_start", "current_period_end", "cancel_at_period_end", "meta_data", "created_at", "updated_at") SELECT "id", "gateway_sub_id", "user_id", "product_id", "pay_method", "status", "interval", "interval_count", "amount", "currency", "current_period_start", "current_period_end", "cancel_at_period_end", "meta_data", "created_at", "updated_at" FROM `subscriptions`;--> statement-breakpoint
DROP TABLE `subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_subscriptions` RENAME TO `subscriptions`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`nickname` text,
	`avatar_url` text,
	`last_login_at` integer,
	`cash_balance` integer DEFAULT 0,
	`grant_balance` integer DEFAULT 0,
	`sub_balance` integer DEFAULT 0,
	`sub_expires_at` integer,
	`tier_level` integer DEFAULT 0,
	`status` integer DEFAULT 1,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "password_hash", "nickname", "avatar_url", "last_login_at", "cash_balance", "grant_balance", "sub_balance", "sub_expires_at", "tier_level", "status", "created_at") SELECT "id", "email", "password_hash", "nickname", "avatar_url", "last_login_at", "cash_balance", "grant_balance", "sub_balance", "sub_expires_at", "tier_level", "status", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `__new_webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`events` text,
	`secret` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_webhooks`("id", "name", "url", "events", "secret", "is_active", "created_at") SELECT "id", "name", "url", "events", "secret", "is_active", "created_at" FROM `webhooks`;--> statement-breakpoint
DROP TABLE `webhooks`;--> statement-breakpoint
ALTER TABLE `__new_webhooks` RENAME TO `webhooks`;