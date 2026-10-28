// Schema Drizzle = sumber kebenaran struktur database. Dari file ini
// drizzle-kit membuat file migration di database/migrations (pnpm db:generate),
// dan Drizzle memberi tipe otomatis untuk setiap query.
//
// Konvensi (lihat docs/DATABASE-SCHEMA.md): nama tabel & kolom Bahasa Inggris,
// snake_case, tabel bentuk jamak (users, products). Komentar Bahasa Indonesia.
//
// Referensi:
// - https://orm.drizzle.team/docs/sql-schema-declaration
// - https://orm.drizzle.team/docs/indexes-constraints

import { bigint, boolean, index, integer, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";

// Kolom id bertipe VARCHAR(36) berisi UUID. UUID dibuat di sisi aplikasi
// dengan crypto.randomUUID() yang sudah tersedia di Node.js.
const id = () =>
  varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// Semua waktu memakai "timestamp with time zone". TIMESTAMP biasa tidak
// menyimpan zona waktu, sehingga jam 09:00 WIB dan 09:00 WITA terbaca sama.
// Dengan timestamptz, PostgreSQL menyimpan waktu dalam UTC.
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const createdAt = () => timestamptz("created_at").notNull().defaultNow();

// DEFAULT CURRENT_TIMESTAMP di SQL hanya terisi saat INSERT.
// $onUpdate membuat Drizzle mengisi ulang kolom ini di setiap UPDATE.
const updatedAt = () =>
  timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// Uang disimpan sebagai bigint dalam RUPIAH (bukan float, bukan sen).
// Rupiah tidak memakai pecahan sen di transaksi sehari-hari, dan bigint
// tidak punya masalah pembulatan seperti float (0.1 + 0.2 !== 0.3).
// mode "number" aman sampai ±9 kuadriliun (Number.MAX_SAFE_INTEGER).
// Dipakai mulai tabel products (belum ada), diekspor agar tidak dianggap tak terpakai.
export const rupiah = (name: string) => bigint(name, { mode: "number" });

// ---------------------------------------------------------------------------
// Toko / tenant (docs/DATABASE-SCHEMA.md §0)
// ---------------------------------------------------------------------------

// SakuDagang multi-tenant: satu deployment melayani banyak toko. Setiap tabel
// bisnis (products, sales, …) punya store_id, dan setiap query dibatasi ke
// toko milik user yang login (lihat lib/auth/dal.ts). Dibuat oleh SUPERADMIN.
export const stores = pgTable("stores", {
  id: id(),
  name: varchar("name", { length: 100 }).notNull(),
  // Jenis usaha, teks bebas untuk sekarang: "Warung sembako", "Toko bangunan".
  businessType: varchar("business_type", { length: 50 }),
  address: varchar("address", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  // Zona waktu toko (Asia/Jakarta, Asia/Makassar, Asia/Jayapura). Menentukan
  // "tanggal hari ini" untuk laporan harian & aturan void hari yang sama.
  timezone: varchar("timezone", { length: 50 }).notNull().default("Asia/Jakarta"),
  // Nonaktif = semua user toko ini tidak bisa login (misal langganan berhenti).
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Akun (docs/DATABASE-SCHEMA.md §1)
// ---------------------------------------------------------------------------

// SUPERADMIN, OWNER, CASHIER. Diisi oleh migration pertama.
export const roles = pgTable("roles", {
  id: id(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    // Toko tempat user bekerja. Null hanya untuk SUPERADMIN (admin platform,
    // tidak terikat toko). OWNER dan CASHIER wajib punya toko.
    storeId: varchar("store_id", { length: 36 }).references(() => stores.id),
    fullName: varchar("full_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 100 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    // Nonaktif = tidak bisa login; riwayat transaksinya tetap ada.
    isActive: boolean("is_active").notNull().default(true),
    // true = password masih sementara (akun baru / di-reset), wajib diganti
    // sebelum bisa memakai aplikasi.
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    // Disimpan juga di cookie session. Setiap password diganti/di-reset, angka
    // ini dinaikkan sehingga semua session lama (di HP/laptop lain) tidak
    // berlaku lagi. Lihat lib/auth/dal.ts.
    sessionVersion: integer("session_version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // Daftar pengguna selalu difilter per toko.
  (t) => [index("users_store_id_idx").on(t.storeId)],
);

// Tabel penghubung many-to-many. Satu user biasanya satu role; Owner
// tidak perlu role CASHIER karena haknya sudah mencakup.
export const userRoles = pgTable(
  "user_roles",
  {
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: varchar("role_id", { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

// Catatan setiap percobaan login, dipakai untuk rate limiting
// (features/auth/rate-limit.ts). Boleh dibersihkan berkala
// (misalnya data > 30 hari dihapus).
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    email: varchar("email", { length: 100 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }), // 45 = panjang maksimal IPv6
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  // Query rate limit selalu berbentuk "email/IP ini, sejak waktu X",
  // jadi index-nya gabungan (kolom pencarian, created_at).
  (t) => [
    index("login_attempts_email_idx").on(t.email, t.createdAt),
    index("login_attempts_ip_idx").on(t.ipAddress, t.createdAt),
  ],
);
