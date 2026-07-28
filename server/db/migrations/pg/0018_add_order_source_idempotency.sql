ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "external_order_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_source_external_order_unique" ON "orders" ("source","external_order_id");
