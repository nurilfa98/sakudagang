-- Kolom users.role menggantikan tabel roles + user_roles (docs/DATABASE-SCHEMA.md §1).
-- Ditambahkan manual: urutan diubah dari hasil drizzle-kit agar role user
-- yang sudah ada disalin dulu sebelum tabel lama dihapus. Kolom dibuat
-- nullable, diisi, baru diberi NOT NULL.
ALTER TABLE "users" ADD COLUMN "role" varchar(20);--> statement-breakpoint
UPDATE "users" u SET "role" = (
  SELECT r."name" FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."role_id"
  WHERE ur."user_id" = u."id" ORDER BY r."name" LIMIT 1
);--> statement-breakpoint
-- Ditambahkan manual: user tanpa baris role (seharusnya tidak ada). Tanpa toko
-- = Superadmin, selain itu dianggap Kasir (hak paling kecil).
UPDATE "users" SET "role" = CASE WHEN "store_id" IS NULL THEN 'SUPERADMIN' ELSE 'CASHIER' END WHERE "role" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('SUPERADMIN', 'OWNER', 'CASHIER'));--> statement-breakpoint
ALTER TABLE "roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "user_roles" CASCADE;--> statement-breakpoint
DROP TABLE "roles" CASCADE;
