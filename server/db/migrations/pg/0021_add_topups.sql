CREATE TABLE IF NOT EXISTS "topups" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL UNIQUE REFERENCES "public"."orders"("id") ON DELETE cascade,
  "user_id" integer NOT NULL REFERENCES "public"."users"("id"),
  "wallet_id" integer NOT NULL REFERENCES "public"."user_wallets"("id"),
  "source" text DEFAULT 'order' NOT NULL,
  "payment_amount" real NOT NULL,
  "payment_currency" text NOT NULL,
  "credit_amount_cents" bigint NOT NULL,
  "credit_currency" text NOT NULL,
  "exchange_rate" real DEFAULT 1 NOT NULL,
  "balance_type" text DEFAULT 'cash' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "credit_event_id" text NOT NULL UNIQUE,
  "refund_event_id" text UNIQUE,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "shortfall_cents" bigint DEFAULT 0 NOT NULL,
  "last_error" text,
  "paid_at" timestamp with time zone,
  "credited_at" timestamp with time zone,
  "refunded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "topups" (
  "order_id", "user_id", "wallet_id", "source", "payment_amount", "payment_currency",
  "credit_amount_cents", "credit_currency", "exchange_rate", "balance_type", "status",
  "credit_event_id", "refund_event_id", "last_error", "paid_at", "credited_at", "refunded_at",
  "created_at", "updated_at"
)
SELECT
  orders."id", orders."user_id", wallets."id", COALESCE(orders."source", 'order'),
  orders."amount", COALESCE(orders."currency", 'USD'),
  COALESCE(credit_log."amount_cents", ROUND(COALESCE(NULLIF(orders."meta_data"->>'recharge_amount', '')::numeric, orders."amount") * 100000000)::bigint),
  COALESCE(orders."meta_data"->>'display_unit', orders."currency", 'USD'),
  COALESCE(NULLIF(orders."meta_data"->'currencySnapshot'->>'exchangeRate', '')::real, 1),
  COALESCE(credit_log."balance_type", orders."meta_data"->>'balance_type', 'cash'),
  CASE
    WHEN orders."pay_status" = 'refunded' AND credit_log."id" IS NOT NULL AND refund_log."id" IS NOT NULL THEN 'refunded'
    WHEN refund_log."id" IS NOT NULL THEN 'review_required'
    WHEN orders."pay_status" = 'refunded' THEN 'review_required'
    WHEN orders."pay_status" = 'paid' AND credit_log."id" IS NOT NULL THEN 'credited'
    WHEN credit_log."id" IS NOT NULL THEN 'review_required'
    WHEN orders."pay_status" = 'paid' THEN 'review_required'
    WHEN orders."pay_status" = 'failed' THEN 'payment_failed'
    ELSE 'pending'
  END,
  'topup:' || orders."id",
  CASE WHEN refund_log."id" IS NOT NULL THEN 'refund:' || orders."id" ELSE NULL END,
  CASE
    WHEN refund_log."id" IS NOT NULL AND (orders."pay_status" <> 'refunded' OR credit_log."id" IS NULL) THEN '历史退款流水与订单或到账流水不一致，需人工核对'
    WHEN orders."pay_status" = 'refunded' AND refund_log."id" IS NULL THEN '历史退款订单没有可确认的 APay 退款流水，需人工核对'
    WHEN credit_log."id" IS NOT NULL AND orders."pay_status" <> 'paid' THEN '历史到账流水与订单支付状态不一致，需人工核对'
    WHEN orders."pay_status" = 'paid' AND credit_log."id" IS NULL THEN '历史订单没有可确认的 APay 到账流水，禁止自动补发'
    ELSE NULL
  END,
  orders."paid_at", credit_log."created_at", refund_log."created_at", orders."created_at", now()
FROM "orders" orders
JOIN "products" products ON products."id" = orders."product_id" AND products."type" = 'topup'
JOIN "user_wallets" wallets ON wallets."user_id" = orders."user_id"
LEFT JOIN "balance_logs" credit_log ON credit_log."event_id" = 'topup:' || orders."id"
LEFT JOIN "balance_logs" refund_log ON refund_log."event_id" = 'refund:' || orders."id"
WHERE COALESCE(products."slug", '') <> 'minimal-checkout-recharge'
  OR orders."meta_data"->'checkoutBridge'->'attach'->>'walletOwner' = 'apay'
ON CONFLICT ("order_id") DO NOTHING;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_topups_user_created_at" ON "topups" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_topups_status_updated_at" ON "topups" ("status", "updated_at");
