CREATE TABLE IF NOT EXISTS "payment_failures" (
        "id" serial PRIMARY KEY NOT NULL,
        "order_id" text NOT NULL,
        "card_bin" text,
        "reason" text NOT NULL,
        "amount" real,
        "pay_method" text,
        "contact_email" text,
        "raw_response" text,
        "visitor_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
        IF to_regclass('public.failures') IS NOT NULL THEN
                INSERT INTO "payment_failures" (
                        "id",
                        "order_id",
                        "card_bin",
                        "reason",
                        "amount",
                        "pay_method",
                        "contact_email",
                        "raw_response",
                        "visitor_id",
                        "created_at"
                )
                SELECT
                        f."id",
                        f."order_id",
                        f."card_bin",
                        f."reason",
                        f."amount",
                        f."pay_method",
                        f."contact_email",
                        f."raw_response",
                        f."visitor_id",
                        f."created_at"
                FROM "failures" f
                WHERE NOT EXISTS (
                        SELECT 1
                        FROM "payment_failures" pf
                        WHERE pf."id" = f."id"
                );
        END IF;
END $$;
--> statement-breakpoint
SELECT setval(
        pg_get_serial_sequence('"payment_failures"', 'id'),
        COALESCE((SELECT MAX("id") FROM "payment_failures"), 0) + 1,
        false
);
