CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `user_id` int NOT NULL,
  `session_id_hash` varchar(64) NOT NULL,
  `status` varchar(32) DEFAULT 'active' NOT NULL,
  `auth_method` varchar(32) DEFAULT 'password' NOT NULL,
  `device_type` varchar(32),
  `browser` varchar(64),
  `os` varchar(64),
  `user_agent` text,
  `ip` varchar(64),
  `country` varchar(100),
  `region` varchar(100),
  `city` varchar(100),
  `logged_in_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `last_seen_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `ended_at` timestamp NULL,
  `replaced_by_session_id` varchar(64),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `user_sessions_session_id_hash_unique` UNIQUE (`session_id_hash`),
  CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_sessions_user_status_idx` ON `user_sessions` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `user_sessions_last_seen_idx` ON `user_sessions` (`last_seen_at`);
