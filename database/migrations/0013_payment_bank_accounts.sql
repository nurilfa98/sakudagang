CREATE TABLE "payment_bank_accounts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"bank_name" varchar(50) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Ditambahkan manual: rekening yang sebelumnya satu kolom di platform_settings
-- disalin ke tabel payment_bank_accounts (bisa lebih dari satu), lalu kolom
-- lamanya dihapus.
INSERT INTO "payment_bank_accounts" ("id", "bank_name", "account_number", "account_name")
SELECT gen_random_uuid()::text, "bank_name", "bank_account_number", COALESCE("bank_account_name", '-')
FROM "platform_settings"
WHERE "bank_name" IS NOT NULL AND "bank_account_number" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" DROP COLUMN "bank_name";--> statement-breakpoint
ALTER TABLE "platform_settings" DROP COLUMN "bank_account_number";--> statement-breakpoint
ALTER TABLE "platform_settings" DROP COLUMN "bank_account_name";