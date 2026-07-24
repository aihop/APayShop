CREATE TABLE IF NOT EXISTS `payment_failures` (
        `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        `order_id` text NOT NULL,
        `card_bin` text,
        `reason` text NOT NULL,
        `amount` real,
        `pay_method` text,
        `contact_email` text,
        `raw_response` text,
        `visitor_id` text,
        `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
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
