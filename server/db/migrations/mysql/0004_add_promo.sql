CREATE TABLE `promo_agent_tiers` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `code` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `role_scope` varchar(64) NOT NULL DEFAULT 'agent',
  `level` int NOT NULL DEFAULT 1,
  `discount_rate` real NOT NULL DEFAULT 1,
  `sales_threshold` real NOT NULL DEFAULT 0,
  `is_fixed` boolean NOT NULL DEFAULT false,
  `is_active` boolean NOT NULL DEFAULT true,
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp DEFAULT now(),
  CONSTRAINT `promo_agent_tiers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `promo_members` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `user_id` int NOT NULL,
  `role` varchar(64) NOT NULL DEFAULT 'member',
  `status` varchar(64) NOT NULL DEFAULT 'active',
  `promo_code` varchar(191) NOT NULL,
  `invite_code` varchar(191) NOT NULL,
  `agent_code` varchar(191),
  `current_agent_tier_id` int,
  `joined_at` timestamp NOT NULL DEFAULT now(),
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `promo_members_user_id_unique` UNIQUE(`user_id`),
  CONSTRAINT `promo_members_promo_code_unique` UNIQUE(`promo_code`),
  CONSTRAINT `promo_members_invite_code_unique` UNIQUE(`invite_code`),
  CONSTRAINT `promo_members_agent_code_unique` UNIQUE(`agent_code`),
  CONSTRAINT `promo_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_members_current_agent_tier_id_promo_agent_tiers_id_fk` FOREIGN KEY (`current_agent_tier_id`) REFERENCES `promo_agent_tiers`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE `promo_invite_relations` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `invitee_user_id` int NOT NULL,
  `inviter_user_id` int NOT NULL,
  `source` varchar(64) NOT NULL DEFAULT 'register',
  `code_snapshot` varchar(191),
  `bound_at` timestamp NOT NULL DEFAULT now(),
  `created_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `promo_invite_relations_invitee_user_id_unique` UNIQUE(`invitee_user_id`),
  CONSTRAINT `promo_invite_relations_invitee_user_id_users_id_fk` FOREIGN KEY (`invitee_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_invite_relations_inviter_user_id_users_id_fk` FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE `promo_agent_relations` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `agent_user_id` int NOT NULL,
  `parent_agent_user_id` int,
  `master_agent_user_id` int,
  `depth` int NOT NULL DEFAULT 1,
  `status` varchar(64) NOT NULL DEFAULT 'active',
  `bound_at` timestamp NOT NULL DEFAULT now(),
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `promo_agent_relations_agent_user_id_unique` UNIQUE(`agent_user_id`),
  CONSTRAINT `promo_agent_relations_agent_user_id_users_id_fk` FOREIGN KEY (`agent_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_agent_relations_parent_agent_user_id_users_id_fk` FOREIGN KEY (`parent_agent_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_agent_relations_master_agent_user_id_users_id_fk` FOREIGN KEY (`master_agent_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE `promo_order_attributions` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `order_id` text NOT NULL,
  `buyer_user_id` int,
  `buyer_promo_member_id` int,
  `invite_user_id` int,
  `agent_user_id` int,
  `parent_agent_user_id` int,
  `master_agent_user_id` int,
  `agent_tier_id_snapshot` int,
  `agent_tier_name_snapshot` varchar(191),
  `discount_rate_snapshot` real,
  `source_type` varchar(64) NOT NULL DEFAULT 'direct',
  `meta_data` json,
  `created_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `promo_order_attributions_order_id_idx` UNIQUE(`order_id`),
  CONSTRAINT `promo_order_attributions_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_order_attributions_buyer_user_id_users_id_fk` FOREIGN KEY (`buyer_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_order_attributions_buyer_promo_member_id_promo_members_id_fk` FOREIGN KEY (`buyer_promo_member_id`) REFERENCES `promo_members`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_order_attributions_invite_user_id_users_id_fk` FOREIGN KEY (`invite_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_order_attributions_agent_user_id_users_id_fk` FOREIGN KEY (`agent_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_order_attributions_parent_agent_user_id_users_id_fk` FOREIGN KEY (`parent_agent_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_order_attributions_master_agent_user_id_users_id_fk` FOREIGN KEY (`master_agent_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE `promo_commissions` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `order_id` text NOT NULL,
  `owner_user_id` int NOT NULL,
  `owner_promo_member_id` int,
  `type` varchar(64) NOT NULL,
  `source_type` varchar(64) NOT NULL DEFAULT 'direct',
  `amount` real NOT NULL,
  `rate` real,
  `status` varchar(64) NOT NULL DEFAULT 'pending',
  `remark` text,
  `meta_data` json,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `promo_commissions_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_commissions_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action,
  CONSTRAINT `promo_commissions_owner_promo_member_id_promo_members_id_fk` FOREIGN KEY (`owner_promo_member_id`) REFERENCES `promo_members`(`id`) ON DELETE no action ON UPDATE no action
);
