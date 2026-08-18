ALTER TABLE `users` ADD COLUMN `current_session_id` text;
--> statement-breakpoint
CREATE TABLE `user_tokens` (
        `id` int AUTO_INCREMENT NOT NULL,
        `user_id` int NOT NULL,
        `token` text NOT NULL,
        `name` text,
        `expires_at` timestamp,
        `last_used_at` timestamp,
        `revoked` boolean DEFAULT false NOT NULL,
        `created_at` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT `user_tokens_id` PRIMARY KEY(`id`),
        CONSTRAINT `user_tokens_token_unique` UNIQUE(`token`),
        CONSTRAINT `user_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE `event_rules` (
        `id` int AUTO_INCREMENT NOT NULL,
        `event` text NOT NULL,
        `action` text NOT NULL,
        `config` json,
        `enabled` boolean DEFAULT true NOT NULL,
        `remark` text,
        `created_at` timestamp NOT NULL DEFAULT (now()),
        `updated_at` timestamp DEFAULT (now()),
        CONSTRAINT `event_rules_id` PRIMARY KEY(`id`)
);
