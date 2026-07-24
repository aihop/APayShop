CREATE TABLE "admins" (
        "id" serial PRIMARY KEY NOT NULL,
        "username" text NOT NULL,
        "password_hash" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "products" (
        "id" serial PRIMARY KEY NOT NULL,
        "slug" text,
        "name" text NOT NULL,
        "price" real NOT NULL,
        "description" text,
        "content" text,
        "type" text NOT NULL,
        "image_url" text,
        "views" integer DEFAULT 0 NOT NULL,
        "image_urls" jsonb,
        "resource" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "meta_data" jsonb,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "email" text NOT NULL,
        "password_hash" text,
        "nickname" text,
        "avatar_url" text,
        "last_login_at" timestamp with time zone,
        "cash_balance" bigint DEFAULT 0,
        "grant_balance" bigint DEFAULT 0,
        "sub_balance" bigint DEFAULT 0,
        "tier_level" integer DEFAULT 0,
        "sub_expires_at" timestamp with time zone,
        "status" integer DEFAULT 1,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "cards" (
        "id" serial PRIMARY KEY NOT NULL,
        "product_id" integer NOT NULL,
        "card_number" text NOT NULL,
        "is_used" boolean DEFAULT false NOT NULL,
        "order_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "cards_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "failures" (
        "id" serial PRIMARY KEY NOT NULL,
        "order_id" text NOT NULL,
        "card_bin" text,
        "reason" text NOT NULL,
        "amount" real,
        "pay_method" text,
        "contact_email" text,
        "raw_response" text,
        "visitor_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
        "id" serial PRIMARY KEY NOT NULL,
        "level" text DEFAULT 'info' NOT NULL,
        "message" text NOT NULL,
        "details" text,
        "source" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "provider" text NOT NULL,
        "provider_account_id" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_account_idx" ON "oauth_accounts" USING btree ("provider","provider_account_id");
--> statement-breakpoint
CREATE TABLE "orders" (
        "id" text PRIMARY KEY NOT NULL,
        "amount" real NOT NULL,
        "product_id" integer NOT NULL,
        "user_id" integer,
        "contact_email" text NOT NULL,
        "pay_method" text,
        "trade_no" text,
        "status" text DEFAULT 'none' NOT NULL,
        "delivery_info" text,
        "meta_data" jsonb,
        "visitor_id" text,
        "subscription_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "paid_at" timestamp with time zone,
        "pay_status" text DEFAULT 'pending' NOT NULL,
        CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action,
        CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "code" text NOT NULL,
        "icon_url" text,
        "is_active" boolean DEFAULT false NOT NULL,
        "config_json" text,
        "info" text,
        "create" text,
        "callback" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "payment_methods_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "posts" (
        "id" serial PRIMARY KEY NOT NULL,
        "slug" text NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "content" text,
        "type" text DEFAULT 'blog' NOT NULL,
        "image_url" text,
        "views" integer DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "meta_data" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now(),
        CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "settings" (
        "key" text PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "description" text,
        "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
        "id" text PRIMARY KEY NOT NULL,
        "gateway_sub_id" text,
        "user_id" integer,
        "product_id" integer NOT NULL,
        "pay_method" text NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "interval" text NOT NULL,
        "interval_count" integer DEFAULT 1 NOT NULL,
        "amount" real NOT NULL,
        "currency" text DEFAULT 'USD' NOT NULL,
        "current_period_start" timestamp with time zone,
        "current_period_end" timestamp with time zone,
        "cancel_at_period_end" boolean DEFAULT false,
        "meta_data" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now(),
        CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
        CONSTRAINT "subscriptions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "theme_settings" (
        "theme_name" text PRIMARY KEY NOT NULL,
        "config" text NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "url" text NOT NULL,
        "events" jsonb,
        "secret" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
