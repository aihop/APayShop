CREATE TABLE `access_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`path` text NOT NULL,
	`method` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`referrer` text,
	`country` text,
	`region` text,
	`city` text,
	`status_code` int,
	`duration` real,
	`visitor_id` text,
	`user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
