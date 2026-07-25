CREATE TABLE IF NOT EXISTS "operation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_type" text DEFAULT 'admin' NOT NULL,
	"actor_id" integer,
	"actor_name" text,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"summary" text,
	"details" text,
	"path" text NOT NULL,
	"method" text NOT NULL,
	"status_code" integer,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operation_logs_created_at_idx" ON "operation_logs" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operation_logs_actor_idx" ON "operation_logs" ("actor_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operation_logs_resource_idx" ON "operation_logs" ("resource","resource_id");
