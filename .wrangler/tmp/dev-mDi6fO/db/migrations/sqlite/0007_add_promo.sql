CREATE TABLE `promo_agent_tiers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `role_scope` text DEFAULT 'agent' NOT NULL,
  `level` integer DEFAULT 1 NOT NULL,
  `discount_rate` real DEFAULT 1 NOT NULL,
  `sales_threshold` real DEFAULT 0 NOT NULL,
  `is_fixed` integer DEFAULT 0 NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `description` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT `promo_agent_tiers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `promo_members` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`),
  `role` text DEFAULT 'member' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `promo_code` text NOT NULL,
  `invite_code` text NOT NULL,
  `agent_code` text,
  `current_agent_tier_id` integer REFERENCES `promo_agent_tiers`(`id`),
  `joined_at` integer NOT NULL DEFAULT (unixepoch()),
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT `promo_members_user_id_unique` UNIQUE(`user_id`),
  CONSTRAINT `promo_members_promo_code_unique` UNIQUE(`promo_code`),
  CONSTRAINT `promo_members_invite_code_unique` UNIQUE(`invite_code`),
  CONSTRAINT `promo_members_agent_code_unique` UNIQUE(`agent_code`)
);
--> statement-breakpoint
CREATE TABLE `promo_invite_relations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `invitee_user_id` integer NOT NULL REFERENCES `users`(`id`),
  `inviter_user_id` integer NOT NULL REFERENCES `users`(`id`),
  `source` text DEFAULT 'register' NOT NULL,
  `code_snapshot` text,
  `bound_at` integer NOT NULL DEFAULT (unixepoch()),
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT `promo_invite_relations_invitee_user_id_unique` UNIQUE(`invitee_user_id`)
);
--> statement-breakpoint
CREATE TABLE `promo_agent_relations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `agent_user_id` integer NOT NULL REFERENCES `users`(`id`),
  `parent_agent_user_id` integer REFERENCES `users`(`id`),
  `master_agent_user_id` integer REFERENCES `users`(`id`),
  `depth` integer DEFAULT 1 NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `bound_at` integer NOT NULL DEFAULT (unixepoch()),
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT `promo_agent_relations_agent_user_id_unique` UNIQUE(`agent_user_id`)
);
--> statement-breakpoint
CREATE TABLE `promo_order_attributions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_id` text NOT NULL REFERENCES `orders`(`id`),
  `buyer_user_id` integer REFERENCES `users`(`id`),
  `buyer_promo_member_id` integer REFERENCES `promo_members`(`id`),
  `invite_user_id` integer REFERENCES `users`(`id`),
  `agent_user_id` integer REFERENCES `users`(`id`),
  `parent_agent_user_id` integer REFERENCES `users`(`id`),
  `master_agent_user_id` integer REFERENCES `users`(`id`),
  `agent_tier_id_snapshot` integer,
  `agent_tier_name_snapshot` text,
  `discount_rate_snapshot` real,
  `source_type` text DEFAULT 'direct' NOT NULL,
  `meta_data` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT `promo_order_attributions_order_id_unique` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `promo_commissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_id` text NOT NULL REFERENCES `orders`(`id`),
  `owner_user_id` integer NOT NULL REFERENCES `users`(`id`),
  `owner_promo_member_id` integer REFERENCES `promo_members`(`id`),
  `type` text NOT NULL,
  `source_type` text DEFAULT 'direct' NOT NULL,
  `amount` real NOT NULL,
  `rate` real,
  `status` text DEFAULT 'pending' NOT NULL,
  `remark` text,
  `meta_data` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
