CREATE TABLE IF NOT EXISTS `user_wallets` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `user_id` int NOT NULL,
  `cash_balance` bigint DEFAULT 0 NOT NULL,
  `grant_balance` bigint DEFAULT 0 NOT NULL,
  `sub_balance` bigint DEFAULT 0 NOT NULL,
  `points_balance` bigint DEFAULT 0 NOT NULL,
  `tier_level` int DEFAULT 0 NOT NULL,
  `sub_expires_at` timestamp NULL,
  `status` int DEFAULT 1 NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `user_wallets_user_id_unique` UNIQUE (`user_id`),
  CONSTRAINT `user_wallets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade
);
--> statement-breakpoint
INSERT IGNORE INTO `user_wallets` (
  `user_id`, `cash_balance`, `grant_balance`, `sub_balance`, `points_balance`,
  `tier_level`, `sub_expires_at`, `status`, `created_at`
)
SELECT
  `id`, COALESCE(`cash_balance`, 0), COALESCE(`grant_balance`, 0), COALESCE(`sub_balance`, 0), 0,
  COALESCE(`tier_level`, 0), `sub_expires_at`, COALESCE(`status`, 1), `created_at`
FROM `users`;
--> statement-breakpoint
ALTER TABLE `balance_logs` ADD COLUMN `wallet_id` int NULL;
--> statement-breakpoint
UPDATE `balance_logs` log
JOIN `user_wallets` wallet ON wallet.`user_id` = log.`user_id`
SET log.`wallet_id` = wallet.`id`
WHERE log.`wallet_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `balance_logs` MODIFY COLUMN `wallet_id` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `balance_logs` ADD CONSTRAINT `balance_logs_wallet_id_user_wallets_id_fk` FOREIGN KEY (`wallet_id`) REFERENCES `user_wallets`(`id`);
--> statement-breakpoint
CREATE INDEX `idx_balance_logs_wallet_created_at` ON `balance_logs` (`wallet_id`, `created_at`);
--> statement-breakpoint
ALTER TABLE `users`
  DROP COLUMN `cash_balance`,
  DROP COLUMN `grant_balance`,
  DROP COLUMN `sub_balance`,
  DROP COLUMN `sub_expires_at`,
  DROP COLUMN `tier_level`;
