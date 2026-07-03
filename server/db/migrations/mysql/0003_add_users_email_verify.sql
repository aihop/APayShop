ALTER TABLE `users` ADD COLUMN `email_verified_at` timestamp;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `email_verify_token` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `email_verify_expires_at` timestamp;
