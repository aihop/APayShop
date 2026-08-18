CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `session_id_hash` text NOT NULL UNIQUE,
  `status` text DEFAULT 'active' NOT NULL,
  `auth_method` text DEFAULT 'password' NOT NULL,
  `device_type` text,
  `browser` text,
  `os` text,
  `user_agent` text,
  `ip` text,
  `country` text,
  `region` text,
  `city` text,
  `logged_in_at` integer DEFAULT (unixepoch()) NOT NULL,
  `last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
  `ended_at` integer,
  `replaced_by_session_id` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_sessions_user_status_idx` ON `user_sessions` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_sessions_last_seen_idx` ON `user_sessions` (`last_seen_at`);
