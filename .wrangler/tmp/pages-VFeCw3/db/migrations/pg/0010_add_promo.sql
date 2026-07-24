CREATE TABLE IF NOT EXISTS "promo_agent_tiers" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "role_scope" text DEFAULT 'agent' NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "discount_rate" real DEFAULT 1 NOT NULL,
  "sales_threshold" real DEFAULT 0 NOT NULL,
  "is_fixed" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "promo_agent_tiers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "role" text DEFAULT 'member' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "promo_code" text NOT NULL,
  "invite_code" text NOT NULL,
  "agent_code" text,
  "current_agent_tier_id" integer REFERENCES "promo_agent_tiers"("id"),
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "promo_members_user_id_unique" UNIQUE("user_id"),
  CONSTRAINT "promo_members_promo_code_unique" UNIQUE("promo_code"),
  CONSTRAINT "promo_members_invite_code_unique" UNIQUE("invite_code"),
  CONSTRAINT "promo_members_agent_code_unique" UNIQUE("agent_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_invite_relations" (
  "id" serial PRIMARY KEY NOT NULL,
  "invitee_user_id" integer NOT NULL REFERENCES "users"("id"),
  "inviter_user_id" integer NOT NULL REFERENCES "users"("id"),
  "source" text DEFAULT 'register' NOT NULL,
  "code_snapshot" text,
  "bound_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "promo_invite_relations_invitee_user_id_unique" UNIQUE("invitee_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_agent_relations" (
  "id" serial PRIMARY KEY NOT NULL,
  "agent_user_id" integer NOT NULL REFERENCES "users"("id"),
  "parent_agent_user_id" integer REFERENCES "users"("id"),
  "master_agent_user_id" integer REFERENCES "users"("id"),
  "depth" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "bound_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "promo_agent_relations_agent_user_id_unique" UNIQUE("agent_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_order_attributions" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL REFERENCES "orders"("id"),
  "buyer_user_id" integer REFERENCES "users"("id"),
  "buyer_promo_member_id" integer REFERENCES "promo_members"("id"),
  "invite_user_id" integer REFERENCES "users"("id"),
  "agent_user_id" integer REFERENCES "users"("id"),
  "parent_agent_user_id" integer REFERENCES "users"("id"),
  "master_agent_user_id" integer REFERENCES "users"("id"),
  "agent_tier_id_snapshot" integer,
  "agent_tier_name_snapshot" text,
  "discount_rate_snapshot" real,
  "source_type" text DEFAULT 'direct' NOT NULL,
  "meta_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "promo_order_attributions_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_commissions" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL REFERENCES "orders"("id"),
  "owner_user_id" integer NOT NULL REFERENCES "users"("id"),
  "owner_promo_member_id" integer REFERENCES "promo_members"("id"),
  "type" text NOT NULL,
  "source_type" text DEFAULT 'direct' NOT NULL,
  "amount" real NOT NULL,
  "rate" real,
  "status" text DEFAULT 'pending' NOT NULL,
  "remark" text,
  "meta_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
