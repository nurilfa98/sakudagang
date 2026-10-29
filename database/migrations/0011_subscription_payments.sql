CREATE TABLE "subscription_payments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"subscription_id" varchar(36) NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"status" varchar(20) NOT NULL,
	"proof_key" varchar(255),
	"note" varchar(255),
	"amount_received" bigint,
	"review_note" varchar(255),
	"reviewed_at" timestamp with time zone,
	"reviewed_by_id" varchar(36),
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_status_check" CHECK ("subscription_payments"."status" IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_status_check";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "amount_paid" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_payments_subscription_idx" ON "subscription_payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_status_idx" ON "subscription_payments" USING btree ("status");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" IN ('PENDING', 'CLAIMED', 'UNDERPAID', 'ACTIVE', 'REJECTED', 'CANCELLED'));--> statement-breakpoint
-- Ditambahkan manual: bukti transfer yang sebelumnya menempel di subscriptions
-- disalin menjadi baris subscription_payments (BUSINESS-FLOW §14.2, 29 Okt 2026).
-- Lunas = nominal diterima penuh; ditolak = pembayaran ditolak; selain itu
-- masih menunggu konfirmasi. Kolom lama dihapus di migration berikutnya.
INSERT INTO "subscription_payments"
  ("id", "subscription_id", "store_id", "status", "proof_key", "note", "amount_received", "review_note", "reviewed_at", "reviewed_by_id", "created_by_id", "created_at")
SELECT
  gen_random_uuid()::text, s."id", s."store_id",
  CASE s."status" WHEN 'ACTIVE' THEN 'ACCEPTED' WHEN 'REJECTED' THEN 'REJECTED' ELSE 'PENDING' END,
  s."proof_key", s."note",
  CASE WHEN s."status" = 'ACTIVE' THEN s."price" END,
  CASE WHEN s."status" = 'REJECTED' THEN s."rejection_note" END,
  CASE s."status" WHEN 'ACTIVE' THEN s."paid_at" WHEN 'REJECTED' THEN s."rejected_at" END,
  s."confirmed_by_id", s."created_by_id", COALESCE(s."claimed_at", s."created_at")
FROM "subscriptions" s
WHERE s."proof_key" IS NOT NULL;--> statement-breakpoint
UPDATE "subscriptions" SET "amount_paid" = "price" WHERE "status" = 'ACTIVE';
