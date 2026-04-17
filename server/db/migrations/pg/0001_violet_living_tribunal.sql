CREATE TABLE "visitor_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"user_id" integer,
	"order_id" text,
	"product_id" integer,
	"event_name" text NOT NULL,
	"event_action" text,
	"path" text,
	"referrer" text,
	"source_type" text,
	"source" text,
	"medium" text,
	"campaign" text,
	"content" text,
	"term" text,
	"country" text,
	"region" text,
	"city" text,
	"locale" text,
	"currency" text,
	"device_type" text,
	"browser" text,
	"os" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_profiles" (
	"visitor_id" text PRIMARY KEY NOT NULL,
	"user_id" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"landing_path" text,
	"first_path" text,
	"last_path" text,
	"first_referrer" text,
	"last_referrer" text,
	"first_source_type" text,
	"last_source_type" text,
	"first_source" text,
	"last_source" text,
	"first_medium" text,
	"last_medium" text,
	"first_campaign" text,
	"last_campaign" text,
	"first_content" text,
	"last_content" text,
	"first_term" text,
	"last_term" text,
	"country" text,
	"region" text,
	"city" text,
	"locale" text,
	"currency" text,
	"device_type" text,
	"browser" text,
	"os" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_methods" DROP CONSTRAINT "payment_methods_code_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "cash_balance" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "grant_balance" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "tier_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD CONSTRAINT "visitor_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD CONSTRAINT "visitor_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD CONSTRAINT "visitor_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_profiles" ADD CONSTRAINT "visitor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;