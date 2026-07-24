CREATE TABLE `notifications` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `user_id` int REFERENCES `users`(`id`),
  `visitor_id` text,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `message` text NOT NULL,
  `data` json,
  `is_read` boolean DEFAULT false NOT NULL,
  `created_at` timestamp DEFAULT now() NOT NULL
);
