CREATE TABLE IF NOT EXISTS `balance_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`balance_type` varchar(20) NOT NULL,
	`action_type` varchar(50) NOT NULL DEFAULT 'topup',
	`amount_cents` bigint NOT NULL,
	`before_balance_cents` bigint NOT NULL,
	`after_balance_cents` bigint NOT NULL,
	`event_id` varchar(191) NOT NULL,
	`source_type` varchar(32) NOT NULL DEFAULT 'system',
	`source_id` varchar(191),
	`operator_admin_id` int,
	`operator_name` varchar(100) NOT NULL DEFAULT '',
	`remark` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `balance_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `balance_logs_event_id_unique` UNIQUE(`event_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_balance_logs_user_created_at` ON `balance_logs` (`user_id`,`created_at`);
