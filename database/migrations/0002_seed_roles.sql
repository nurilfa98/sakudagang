-- Ditambahkan manual (custom migration): data awal roles, lihat
-- docs/DATABASE-SCHEMA.md §9. Akun SUPERADMIN pertama dibuat lewat
-- `pnpm db:create-superadmin`, bukan di sini. Aman dijalankan ulang.
INSERT INTO "roles" ("id", "name") VALUES
  (gen_random_uuid()::text, 'SUPERADMIN'),
  (gen_random_uuid()::text, 'OWNER'),
  (gen_random_uuid()::text, 'CASHIER')
ON CONFLICT ("name") DO NOTHING;
