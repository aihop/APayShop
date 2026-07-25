CREATE TABLE IF NOT EXISTS `balance_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `balance_logs_event_id_unique` ON `balance_logs` (`event_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_balance_logs_user_created_at` ON `balance_logs` (`user_id`,`created_at`);
