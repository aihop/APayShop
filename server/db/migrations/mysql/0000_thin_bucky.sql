CREATE TABLE `admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(191) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `admins_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`key_string` varchar(64) NOT NULL,
	`user_id` int,
	`status` int DEFAULT 1,
	`tier_level` int NOT NULL DEFAULT 0,
	`order_id` text,
	`product_id` int,
	`quota_limit` bigint NOT NULL DEFAULT 0,
	`quota_used` bigint NOT NULL DEFAULT 0,
	`allowed_models` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_key_string_unique` UNIQUE(`key_string`)
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`card_number` text NOT NULL,
	`is_used` boolean NOT NULL DEFAULT false,
	`order_id` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `failures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`card_bin` text,
	`reason` text NOT NULL,
	`amount` real,
	`pay_method` text,
	`contact_email` text,
	`raw_response` text,
	`visitor_id` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `failures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`level` text NOT NULL DEFAULT ('info'),
	`message` text NOT NULL,
	`details` text,
	`source` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`provider` varchar(191) NOT NULL,
	`provider_account_id` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oauth_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_account_idx` UNIQUE(`provider`,`provider_account_id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text NOT NULL,
	`amount` real NOT NULL,
	`product_id` int NOT NULL,
	`user_id` int,
	`contact_email` text NOT NULL,
	`pay_method` text,
	`trade_no` text,
	`status` text NOT NULL DEFAULT ('none'),
	`delivery_info` text,
	`meta_data` json,
	`visitor_id` text,
	`subscription_id` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`paid_at` timestamp,
	`pay_status` text NOT NULL DEFAULT ('pending'),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`icon_url` text,
	`is_active` boolean NOT NULL DEFAULT false,
	`config_json` text,
	`info` text,
	`create` text,
	`callback` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` text,
	`sort` int,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`content` text,
	`type` text NOT NULL DEFAULT ('blog'),
	`image_url` text,
	`views` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`meta_data` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` text,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`description` text,
	`content` text,
	`type` text NOT NULL,
	`image_url` text,
	`views` int NOT NULL DEFAULT 0,
	`image_urls` json,
	`resource` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`meta_data` json,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text NOT NULL,
	`gateway_sub_id` text,
	`user_id` int,
	`product_id` int NOT NULL,
	`pay_method` text NOT NULL,
	`status` text NOT NULL DEFAULT ('active'),
	`interval` text NOT NULL,
	`interval_count` int NOT NULL DEFAULT 1,
	`amount` real NOT NULL,
	`currency` text NOT NULL DEFAULT ('USD'),
	`current_period_start` timestamp,
	`current_period_end` timestamp,
	`cancel_at_period_end` boolean DEFAULT false,
	`meta_data` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme_settings` (
	`theme_name` text NOT NULL,
	`config` text NOT NULL,
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `theme_settings_theme_name` PRIMARY KEY(`theme_name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`nickname` text,
	`avatar_url` text,
	`last_login_at` timestamp,
	`cash_balance` bigint DEFAULT 0,
	`grant_balance` bigint DEFAULT 0,
	`tier_level` int DEFAULT 0,
	`grant_expires_at` timestamp,
	`status` int DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `visitor_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitor_id` text NOT NULL,
	`user_id` int,
	`order_id` text,
	`product_id` int,
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
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitor_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visitor_profiles` (
	`visitor_id` text NOT NULL,
	`user_id` int,
	`first_seen_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
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
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitor_profiles_visitor_id` PRIMARY KEY(`visitor_id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`events` json,
	`secret` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cards` ADD CONSTRAINT `cards_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_accounts` ADD CONSTRAINT `oauth_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visitor_events` ADD CONSTRAINT `visitor_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visitor_events` ADD CONSTRAINT `visitor_events_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visitor_events` ADD CONSTRAINT `visitor_events_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visitor_profiles` ADD CONSTRAINT `visitor_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;