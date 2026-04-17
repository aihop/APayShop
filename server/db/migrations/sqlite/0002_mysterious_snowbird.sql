DROP INDEX `provider_account_idx`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(50),
	`key_string` text(64) NOT NULL,
	`user_id` integer,
	`status` integer DEFAULT 1,
	`order_id` text,
	`product_id` integer,
	`quota_limit` integer DEFAULT 0 NOT NULL,
	`quota_used` integer DEFAULT 0 NOT NULL,
	`allowed_models` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`("id", "name", "key_string", "user_id", "status", "order_id", "product_id", "quota_limit", "quota_used", "allowed_models", "is_active", "created_at") SELECT "id", "name", "key_string", "user_id", "status", "order_id", "product_id", "quota_limit", "quota_used", "allowed_models", "is_active", "created_at" FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_string_unique` ON `api_keys` (`key_string`);