CREATE TABLE IF NOT EXISTS `payment_failures` (
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
        CONSTRAINT `payment_failures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
SET @has_old_payment_failures_source := (
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'failures'
);
--> statement-breakpoint
SET @copy_payment_failures_sql := IF(
        @has_old_payment_failures_source > 0,
        'INSERT IGNORE INTO `payment_failures` (`id`, `order_id`, `card_bin`, `reason`, `amount`, `pay_method`, `contact_email`, `raw_response`, `visitor_id`, `created_at`) SELECT `id`, `order_id`, `card_bin`, `reason`, `amount`, `pay_method`, `contact_email`, `raw_response`, `visitor_id`, `created_at` FROM `failures`',
        'SELECT 1'
);
--> statement-breakpoint
PREPARE payment_failures_copy_stmt FROM @copy_payment_failures_sql;
--> statement-breakpoint
EXECUTE payment_failures_copy_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE payment_failures_copy_stmt;
--> statement-breakpoint
SET @next_payment_failures_id := (SELECT COALESCE(MAX(`id`), 0) + 1 FROM `payment_failures`);
--> statement-breakpoint
SET @payment_failures_autoinc_sql := CONCAT('ALTER TABLE `payment_failures` AUTO_INCREMENT = ', @next_payment_failures_id);
--> statement-breakpoint
PREPARE payment_failures_autoinc_stmt FROM @payment_failures_autoinc_sql;
--> statement-breakpoint
EXECUTE payment_failures_autoinc_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE payment_failures_autoinc_stmt;
