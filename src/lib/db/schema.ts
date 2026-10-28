// Schema Drizzle = sumber kebenaran struktur database. Dari file ini
// drizzle-kit membuat file migration di database/migrations (pnpm db:generate),
// dan Drizzle memberi tipe otomatis untuk setiap query.
//
// Saat ini belum ada tabel. Tambahkan tabel di bawah helper kolom ini, lalu
// jalankan `pnpm db:generate` dan `pnpm db:migrate` (lihat database/README.md).
//
// Referensi:
// - https://orm.drizzle.team/docs/sql-schema-declaration
// - https://orm.drizzle.team/docs/indexes-constraints

import { bigint, timestamp, varchar } from "drizzle-orm/pg-core";

// Kolom id bertipe VARCHAR(36) berisi UUID. UUID dibuat di sisi aplikasi
// dengan crypto.randomUUID() yang sudah tersedia di Node.js.
export const id = () =>
  varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// Semua waktu memakai "timestamp with time zone". TIMESTAMP biasa tidak
// menyimpan zona waktu, sehingga jam 09:00 WIB dan 09:00 WITA terbaca sama.
// Dengan timestamptz, PostgreSQL menyimpan waktu dalam UTC.
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const createdAt = () => timestamptz("created_at").notNull().defaultNow();

// Uang disimpan sebagai bigint dalam RUPIAH (bukan float, bukan sen).
// Rupiah tidak memakai pecahan sen di transaksi sehari-hari, dan bigint
// tidak punya masalah pembulatan seperti float (0.1 + 0.2 !== 0.3).
// mode "number" aman sampai ±9 kuadriliun (Number.MAX_SAFE_INTEGER).
export const rupiah = (name: string) => bigint(name, { mode: "number" });

// Contoh tabel:
//
// export const products = pgTable("products", {
//   id: id(),
//   name: varchar("name", { length: 100 }).notNull(),
//   price: rupiah("price").notNull(),
//   createdAt: createdAt(),
// });
