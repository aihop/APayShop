CREATE TABLE "access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"method" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"referrer" text,
	"country" text,
	"region" text,
	"city" text,
	"status_code" integer,
	"duration" real,
	"visitor_id" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
