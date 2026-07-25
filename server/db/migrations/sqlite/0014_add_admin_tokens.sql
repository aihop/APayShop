CREATE TABLE `admin_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` integer NOT NULL,
	`token` text NOT NULL,
	`name` text,
	`permissions` text,
	`expires_at` integer,
	`last_used_at` integer,
	`revoked` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `admin_tokens_token_unique` UNIQUE(`token`)
);
