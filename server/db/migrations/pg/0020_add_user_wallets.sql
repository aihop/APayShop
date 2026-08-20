CREATE TABLE IF NOT EXISTS "user_wallets" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "cash_balance" bigint DEFAULT 0 NOT NULL,
  "grant_balance" bigint DEFAULT 0 NOT NULL,
  "sub_balance" bigint DEFAULT 0 NOT NULL,
  "points_balance" bigint DEFAULT 0 NOT NULL,
  "tier_level" integer DEFAULT 0 NOT NULL,
  "sub_expires_at" timestamp with time zone,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_wallets_user_id_unique" UNIQUE ("user_id"),
  CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
INSERT INTO "user_wallets" (
  "user_id", "cash_balance", "grant_balance", "sub_balance", "points_balance",
  "tier_level", "sub_expires_at", "status", "created_at"
)
SELECT
  "id", COALESCE("cash_balance", 0), COALESCE("grant_balance", 0), COALESCE("sub_balance", 0), 0,
  COALESCE("tier_level", 0), "sub_expires_at", COALESCE("status", 1), "created_at"
FROM "users"
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "balance_logs" ADD COLUMN IF NOT EXISTS "wallet_id" integer;
--> statement-breakpoint
UPDATE "balance_logs" AS log
SET "wallet_id" = wallet."id"
FROM "user_wallets" AS wallet
WHERE log."wallet_id" IS NULL AND wallet."user_id" = log."user_id";
--> statement-breakpoint
ALTER TABLE "balance_logs" ALTER COLUMN "wallet_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "balance_logs" ADD CONSTRAINT "balance_logs_wallet_id_user_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."user_wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_balance_logs_wallet_created_at" ON "balance_logs" ("wallet_id", "created_at" DESC);
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "cash_balance";
ALTER TABLE "users" DROP COLUMN IF EXISTS "grant_balance";
ALTER TABLE "users" DROP COLUMN IF EXISTS "sub_balance";
ALTER TABLE "users" DROP COLUMN IF EXISTS "sub_expires_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "tier_level";
