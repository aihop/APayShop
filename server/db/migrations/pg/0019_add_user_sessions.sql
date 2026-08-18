CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "session_id_hash" text NOT NULL UNIQUE,
  "status" text DEFAULT 'active' NOT NULL,
  "auth_method" text DEFAULT 'password' NOT NULL,
  "device_type" text,
  "browser" text,
  "os" text,
  "user_agent" text,
  "ip" text,
  "country" text,
  "region" text,
  "city" text,
  "logged_in_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "replaced_by_session_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_user_status_idx" ON "user_sessions" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_last_seen_idx" ON "user_sessions" ("last_seen_at");
