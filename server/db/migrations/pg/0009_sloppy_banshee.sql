-- 说明：0002~0008 这几个迁移文件是历史上手写补的，当时没有同步生成 meta/snapshot，
-- 导致 drizzle-kit generate 一直是拿 0001 快照在跟当前 schema.pg.ts 比对，
-- 把 access_logs / notifications / posts.key,sort / visitor_events.ip 等其实早就
-- 建过的东西也当成缺失重新吐出来。这里手工核对了生产库实际结构，只保留真正
-- 还没建过的四项，并加上 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS 兜底，避免
-- 两边环境状态判断有误时把已存在的对象重建报错。
CREATE TABLE IF NOT EXISTS "email_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"config_json" text,
	"send_script" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"action" text NOT NULL,
	"config" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"name" text,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_session_id" text;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- 邮箱验证改用 user_tokens 表存 token（见 server/api/auth/register.post.ts /
-- verify-email.get.ts），users 表上这两列不再需要。生产库当时是靠某次单独的
-- db:pg:push 手动加上的，核对过待验证且未过期的行数是 0，可以直接安全丢弃。
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verify_token";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verify_expires_at";
