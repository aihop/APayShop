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
        `created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
