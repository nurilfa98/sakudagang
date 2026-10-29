CREATE TABLE "platform_settings" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"admin_phone" varchar(20),
	"bank_name" varchar(50),
	"bank_account_number" varchar(50),
	"bank_account_name" varchar(100),
	"qris_image_key" varchar(255),
	"free_days" integer DEFAULT 28 NOT NULL,
	"grace_days" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_plan_prices" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"months" smallint NOT NULL,
	"price" bigint NOT NULL,
	"note" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"months" smallint NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_months_unique" UNIQUE("months")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"months" smallint NOT NULL,
	"price" bigint NOT NULL,
	"status" varchar(20) NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"note" varchar(255),
	"created_by_id" varchar(36) NOT NULL,
	"confirmed_by_id" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" IN ('PENDING', 'ACTIVE', 'CANCELLED'))
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "subscription_until" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "store_plan_prices" ADD CONSTRAINT "store_plan_prices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_plan_prices_store_months_idx" ON "store_plan_prices" USING btree ("store_id","months");--> statement-breakpoint
CREATE INDEX "subscriptions_store_idx" ON "subscriptions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
-- Ditambahkan manual (custom migration), lihat docs/BUSINESS-FLOW.md §14.
-- Baris pengaturan tunggal dan tiga paket standar (harga 0 = belum diatur,
-- diisi Superadmin di menu Pengaturan). Aman dijalankan ulang.
INSERT INTO "platform_settings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "subscription_plans" ("id", "months", "price") VALUES
  (gen_random_uuid()::text, 1, 0),
  (gen_random_uuid()::text, 6, 0),
  (gen_random_uuid()::text, 12, 0)
ON CONFLICT ("months") DO NOTHING;--> statement-breakpoint
-- Toko yang sudah ada sebelum fitur langganan mendapat masa gratis 28 hari
-- terhitung sejak migration ini dijalankan.
UPDATE "stores" SET "subscription_until" = now() + interval '28 days';
