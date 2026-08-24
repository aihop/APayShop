CREATE TABLE IF NOT EXISTS "ext_example_tools_records" (
  "id" serial PRIMARY KEY,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
