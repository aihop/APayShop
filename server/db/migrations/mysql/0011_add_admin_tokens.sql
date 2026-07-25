CREATE TABLE `admin_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`admin_id` int NOT NULL,
	`token` text NOT NULL,
	`name` text,
	`permissions` json,
	`expires_at` timestamp,
	`last_used_at` timestamp,
	`revoked` boolean DEFAULT false NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_tokens_token_unique` UNIQUE(`token`),
	CONSTRAINT `admin_tokens_admin_id_admins_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE no action ON UPDATE no action
);
