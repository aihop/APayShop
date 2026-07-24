CREATE TABLE `notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer REFERENCES `users`(`id`),
  `visitor_id` text,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `message` text NOT NULL,
  `data` text,
  `is_read` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
