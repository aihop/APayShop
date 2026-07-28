ALTER TABLE `orders` ADD `source` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `external_order_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_source_external_order_unique` ON `orders` (`source`,`external_order_id`);
