CREATE TABLE IF NOT EXISTS "balance_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance_type" text NOT NULL,
	"action_type" text DEFAULT 'topup' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"before_balance_cents" bigint NOT NULL,
	"after_balance_cents" bigint NOT NULL,
	"event_id" text NOT NULL,
	"source_type" text DEFAULT 'system' NOT NULL,
	"source_id" text,
	"operator_admin_id" integer,
	"operator_name" text DEFAULT '' NOT NULL,
	"remark" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_logs_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "balance_logs" ADD CONSTRAINT "balance_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_balance_logs_user_created_at" ON "balance_logs" ("user_id","created_at" DESC);
