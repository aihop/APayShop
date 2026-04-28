ALTER TABLE "posts" ADD COLUMN "key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "posts_type_key_unique" ON "posts" ("type","key");
