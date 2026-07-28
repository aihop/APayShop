ALTER TABLE `orders` ADD COLUMN `source` varchar(64);
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `external_order_id` varchar(128);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_source_external_order_unique` ON `orders` (`source`,`external_order_id`);
