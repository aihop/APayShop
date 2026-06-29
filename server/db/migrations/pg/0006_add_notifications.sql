CREATE TABLE "notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer REFERENCES "users"("id"),
  "visitor_id" text,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "data" jsonb,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
