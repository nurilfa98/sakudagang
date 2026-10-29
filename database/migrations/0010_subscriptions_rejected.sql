ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_status_check";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" IN ('PENDING', 'CLAIMED', 'ACTIVE', 'REJECTED', 'CANCELLED'));--> statement-breakpoint
-- Ditambahkan manual: tagihan "menunggu pembayaran" dari alur lama (pilih
-- paket langsung tersimpan) ditutup, karena alur baru hanya menyimpan tagihan
-- saat pemilik menekan "Saya sudah bayar" (BUSINESS-FLOW §14.2).
UPDATE "subscriptions" SET "status" = 'CANCELLED' WHERE "status" = 'PENDING';
