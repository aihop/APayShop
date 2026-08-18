INSERT OR IGNORE INTO `payment_failures` (
        `id`,
        `order_id`,
        `card_bin`,
        `reason`,
        `amount`,
        `pay_method`,
        `contact_email`,
        `raw_response`,
        `visitor_id`,
        `created_at`
)
SELECT
        `id`,
        `order_id`,
        `card_bin`,
        `reason`,
        `amount`,
        `pay_method`,
        `contact_email`,
        `raw_response`,
        `visitor_id`,
        `created_at`
FROM `failures`;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `current_session_id` text;
--> statement-breakpoint
CREATE TABLE `user_tokens` (
        `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        `user_id` integer NOT NULL,
        `token` text NOT NULL,
        `name` text,
        `expires_at` integer,
        `last_used_at` integer,
        `revoked` integer DEFAULT 0 NOT NULL,
        `created_at` integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
        CONSTRAINT `user_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `event_rules` (
        `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        `event` text NOT NULL,
        `action` text NOT NULL,
        `config` text,
        `enabled` integer DEFAULT true NOT NULL,
        `remark` text,
        `created_at` integer DEFAULT (unixepoch()) NOT NULL,
        `updated_at` integer
);
