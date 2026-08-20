CREATE TABLE IF NOT EXISTS `topups` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `order_id` varchar(191) NOT NULL,
  `user_id` int NOT NULL,
  `wallet_id` int NOT NULL,
  `source` varchar(32) DEFAULT 'order' NOT NULL,
  `payment_amount` real NOT NULL,
  `payment_currency` varchar(16) NOT NULL,
  `credit_amount_cents` bigint NOT NULL,
  `credit_currency` varchar(16) NOT NULL,
  `exchange_rate` real DEFAULT 1 NOT NULL,
  `balance_type` varchar(20) DEFAULT 'cash' NOT NULL,
  `status` varchar(32) DEFAULT 'pending' NOT NULL,
  `credit_event_id` varchar(255) NOT NULL,
  `refund_event_id` varchar(255),
  `retry_count` int DEFAULT 0 NOT NULL,
  `shortfall_cents` bigint DEFAULT 0 NOT NULL,
  `last_error` text,
  `paid_at` timestamp NULL,
  `credited_at` timestamp NULL,
  `refunded_at` timestamp NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `topups_order_id_unique` UNIQUE (`order_id`),
  CONSTRAINT `topups_credit_event_id_unique` UNIQUE (`credit_event_id`),
  CONSTRAINT `topups_refund_event_id_unique` UNIQUE (`refund_event_id`),
  CONSTRAINT `topups_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `topups_wallet_id_user_wallets_id_fk` FOREIGN KEY (`wallet_id`) REFERENCES `user_wallets`(`id`)
);
--> statement-breakpoint
INSERT IGNORE INTO `topups` (
  `order_id`, `user_id`, `wallet_id`, `source`, `payment_amount`, `payment_currency`,
  `credit_amount_cents`, `credit_currency`, `exchange_rate`, `balance_type`, `status`,
  `credit_event_id`, `refund_event_id`, `last_error`, `paid_at`, `credited_at`, `refunded_at`,
  `created_at`, `updated_at`
)
SELECT
  orders.`id`, orders.`user_id`, wallets.`id`, COALESCE(orders.`source`, 'order'),
  orders.`amount`, COALESCE(orders.`currency`, 'USD'),
  COALESCE(credit_log.`amount_cents`, ROUND(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(orders.`meta_data`, '$.recharge_amount')) + 0, orders.`amount`) * 100000000)),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(orders.`meta_data`, '$.display_unit')), orders.`currency`, 'USD'),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(orders.`meta_data`, '$.currencySnapshot.exchangeRate')) + 0, 1),
  COALESCE(credit_log.`balance_type`, JSON_UNQUOTE(JSON_EXTRACT(orders.`meta_data`, '$.balance_type')), 'cash'),
  CASE
    WHEN orders.`pay_status` = 'refunded' AND credit_log.`id` IS NOT NULL AND refund_log.`id` IS NOT NULL THEN 'refunded'
    WHEN refund_log.`id` IS NOT NULL THEN 'review_required'
    WHEN orders.`pay_status` = 'refunded' THEN 'review_required'
    WHEN orders.`pay_status` = 'paid' AND credit_log.`id` IS NOT NULL THEN 'credited'
    WHEN credit_log.`id` IS NOT NULL THEN 'review_required'
    WHEN orders.`pay_status` = 'paid' THEN 'review_required'
    WHEN orders.`pay_status` = 'failed' THEN 'payment_failed'
    ELSE 'pending'
  END,
  CONCAT('topup:', orders.`id`),
  CASE WHEN refund_log.`id` IS NOT NULL THEN CONCAT('refund:', orders.`id`) ELSE NULL END,
  CASE
    WHEN refund_log.`id` IS NOT NULL AND (orders.`pay_status` <> 'refunded' OR credit_log.`id` IS NULL) THEN '历史退款流水与订单或到账流水不一致，需人工核对'
    WHEN orders.`pay_status` = 'refunded' AND refund_log.`id` IS NULL THEN '历史退款订单没有可确认的 APay 退款流水，需人工核对'
    WHEN credit_log.`id` IS NOT NULL AND orders.`pay_status` <> 'paid' THEN '历史到账流水与订单支付状态不一致，需人工核对'
    WHEN orders.`pay_status` = 'paid' AND credit_log.`id` IS NULL THEN '历史订单没有可确认的 APay 到账流水，禁止自动补发'
    ELSE NULL
  END,
  orders.`paid_at`, credit_log.`created_at`, refund_log.`created_at`, orders.`created_at`, CURRENT_TIMESTAMP
FROM `orders` orders
JOIN `products` products ON products.`id` = orders.`product_id` AND products.`type` = 'topup'
JOIN `user_wallets` wallets ON wallets.`user_id` = orders.`user_id`
LEFT JOIN `balance_logs` credit_log ON credit_log.`event_id` = CONCAT('topup:', orders.`id`)
LEFT JOIN `balance_logs` refund_log ON refund_log.`event_id` = CONCAT('refund:', orders.`id`)
WHERE COALESCE(products.`slug`, '') <> 'minimal-checkout-recharge'
  OR JSON_UNQUOTE(JSON_EXTRACT(orders.`meta_data`, '$.checkoutBridge.attach.walletOwner')) = 'apay';
--> statement-breakpoint
CREATE INDEX `idx_topups_user_created_at` ON `topups` (`user_id`, `created_at`);
CREATE INDEX `idx_topups_status_updated_at` ON `topups` (`status`, `updated_at`);
