CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `to` text NOT NULL,
  `subject` text NOT NULL,
  `template_code` text,
  `html` text,
  `provider` text,
  `status` varchar(32) DEFAULT 'success' NOT NULL,
  `message_id` text,
  `error` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_logs_status_idx` ON `email_logs` (`status`);
--> statement-breakpoint
CREATE INDEX `email_logs_created_at_idx` ON `email_logs` (`created_at`);
