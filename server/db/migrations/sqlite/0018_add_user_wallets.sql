CREATE TABLE `user_wallets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL UNIQUE,
  `cash_balance` integer DEFAULT 0 NOT NULL,
  `grant_balance` integer DEFAULT 0 NOT NULL,
  `sub_balance` integer DEFAULT 0 NOT NULL,
  `points_balance` integer DEFAULT 0 NOT NULL,
  `tier_level` integer DEFAULT 0 NOT NULL,
  `sub_expires_at` integer,
  `status` integer DEFAULT 1 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `user_wallets` (
  `user_id`, `cash_balance`, `grant_balance`, `sub_balance`, `points_balance`,
  `tier_level`, `sub_expires_at`, `status`, `created_at`
)
SELECT
  `id`, COALESCE(`cash_balance`, 0), COALESCE(`grant_balance`, 0), COALESCE(`sub_balance`, 0), 0,
  COALESCE(`tier_level`, 0), `sub_expires_at`, COALESCE(`status`, 1), `created_at`
FROM `users`;
--> statement-breakpoint
CREATE TABLE `__new_balance_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `wallet_id` integer NOT NULL,
  `balance_type` text NOT NULL,
  `action_type` text DEFAULT 'topup' NOT NULL,
  `amount_cents` integer NOT NULL,
  `before_balance_cents` integer NOT NULL,
  `after_balance_cents` integer NOT NULL,
  `event_id` text NOT NULL,
  `source_type` text DEFAULT 'system' NOT NULL,
  `source_id` text,
  `operator_admin_id` integer,
  `operator_name` text DEFAULT '' NOT NULL,
  `remark` text DEFAULT '' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`wallet_id`) REFERENCES `user_wallets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_balance_logs` (
  `id`, `user_id`, `wallet_id`, `balance_type`, `action_type`, `amount_cents`,
  `before_balance_cents`, `after_balance_cents`, `event_id`, `source_type`, `source_id`,
  `operator_admin_id`, `operator_name`, `remark`, `created_at`
)
SELECT
  log.`id`, log.`user_id`, wallet.`id`, log.`balance_type`, log.`action_type`, log.`amount_cents`,
  log.`before_balance_cents`, log.`after_balance_cents`, log.`event_id`, log.`source_type`, log.`source_id`,
  log.`operator_admin_id`, log.`operator_name`, log.`remark`, log.`created_at`
FROM `balance_logs` log
JOIN `user_wallets` wallet ON wallet.`user_id` = log.`user_id`;
--> statement-breakpoint
DROP TABLE `balance_logs`;
--> statement-breakpoint
ALTER TABLE `__new_balance_logs` RENAME TO `balance_logs`;
--> statement-breakpoint
CREATE UNIQUE INDEX `balance_logs_event_id_unique` ON `balance_logs` (`event_id`);
CREATE INDEX `idx_balance_logs_user_created_at` ON `balance_logs` (`user_id`, `created_at`);
CREATE INDEX `idx_balance_logs_wallet_created_at` ON `balance_logs` (`wallet_id`, `created_at`);
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `cash_balance`;
ALTER TABLE `users` DROP COLUMN `grant_balance`;
ALTER TABLE `users` DROP COLUMN `sub_balance`;
ALTER TABLE `users` DROP COLUMN `sub_expires_at`;
ALTER TABLE `users` DROP COLUMN `tier_level`;
