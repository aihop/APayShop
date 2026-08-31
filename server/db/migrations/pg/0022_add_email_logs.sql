CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "to" text NOT NULL,
  "subject" text NOT NULL,
  "template_code" text,
  "html" text,
  "provider" text,
  "status" text DEFAULT 'success' NOT NULL,
  "message_id" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_to_idx" ON "email_logs" ("to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_status_idx" ON "email_logs" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_created_at_idx" ON "email_logs" ("created_at");
