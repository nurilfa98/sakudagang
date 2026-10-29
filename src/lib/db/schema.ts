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

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

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
const rupiah = (name: string) => bigint(name, { mode: "number" });

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
  // Saklar manual Superadmin (toko bermasalah). Nonaktif = semua user toko
  // ini tidak bisa login, apa pun status langganannya.
  isActive: boolean("is_active").notNull().default(true),
  // Akhir masa gratis / langganan (BUSINESS-FLOW §14). Diisi saat toko dibuat
  // (sekarang + masa gratis) dan setiap tagihan lunas. Lewat tanggal ini +
  // masa tenggang → akses toko dikunci (lib/auth/dal.ts). Tidak perlu job harian.
  subscriptionUntil: timestamptz("subscription_until").notNull().defaultNow(),
  // Pengingat WhatsApp terakhir yang sudah dikirim, "<tanggal berakhir>:<H->"
  // (features/subscriptions/reminders.ts), agar cron tidak mengirim dobel.
  lastReminderKey: varchar("last_reminder_key", { length: 20 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Akun (docs/DATABASE-SCHEMA.md §1)
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: id(),
    // Toko tempat user bekerja. Null hanya untuk SUPERADMIN (admin platform,
    // tidak terikat toko). OWNER dan CASHIER wajib punya toko.
    storeId: varchar("store_id", { length: 36 }).references(() => stores.id),
    // Satu user satu role. Disimpan varchar (bukan tabel/enum PostgreSQL),
    // sama seperti kolom status lain: daftar nilainya di lib/auth/roles.ts,
    // dijaga CHECK constraint di bawah. Tidak perlu seed data.
    role: varchar("role", { length: 20 }).notNull(),
    fullName: varchar("full_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 100 }).notNull().unique(),
    // Nomor WhatsApp format 62… (lib/phone.ts), untuk mengirim undangan login.
    phone: varchar("phone", { length: 20 }),
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
  (t) => [
    // Daftar pengguna selalu difilter per toko.
    index("users_store_id_idx").on(t.storeId),
    // Nilai role harus salah satu dari lib/auth/roles.ts (ROLES).
    check("users_role_check", sql`${t.role} IN ('SUPERADMIN', 'OWNER', 'CASHIER')`),
  ],
);

// ---------------------------------------------------------------------------
// Barang & stok (docs/DATABASE-SCHEMA.md §2)
// ---------------------------------------------------------------------------

// Semua tabel bisnis terikat satu toko (multi-tenant). Setiap query WAJIB
// memfilter store_id (lihat requireStore di lib/auth/dal.ts).
const storeRef = () =>
  varchar("store_id", { length: 36 })
    .notNull()
    .references(() => stores.id);

const userRef = (name: string) => varchar(name, { length: 36 }).references(() => users.id);

// Kategori per toko. Diisi awal saat toko dibuat (lib/store-defaults.ts),
// pemilik bisa menambah/mengubah.
export const productCategories = pgTable(
  "product_categories",
  {
    id: id(),
    storeId: storeRef(),
    name: varchar("name", { length: 50 }).notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("product_categories_store_name_idx").on(t.storeId, t.name)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    storeId: storeRef(),
    categoryId: varchar("category_id", { length: 36 })
      .notNull()
      .references(() => productCategories.id),
    name: varchar("name", { length: 100 }).notNull(),
    // Label satuan (pcs, kg, bungkus). Qty selalu bilangan bulat (BUSINESS-FLOW §3).
    unit: varchar("unit", { length: 20 }).notNull(),
    // Harga modal rata-rata tertimbang. TURUNAN dari stock_movements: hanya
    // diubah lewat lib/stock.ts (stok awal, pembelian, pembatalan pembelian).
    costPrice: rupiah("cost_price").notNull().default(0),
    sellingPrice: rupiah("selling_price").notNull(),
    // TURUNAN dari Σ stock_movements.qty; diubah hanya lewat lib/stock.ts.
    // Boleh negatif (stok minus diperbolehkan, BUSINESS-FLOW §5.3).
    stock: integer("stock").notNull().default(0),
    // Bila stok ≤ ini, masuk daftar "perlu restock". Null = tidak dipantau.
    minStock: integer("min_stock"),
    // Nonaktif = tidak muncul di kasir; riwayatnya tetap ada. Barang yang
    // sudah pernah dipakai transaksi tidak pernah dihapus.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_store_name_idx").on(t.storeId, t.name),
    // Pencarian kasir: barang aktif satu toko.
    index("products_store_active_idx").on(t.storeId, t.isActive),
    index("products_category_idx").on(t.categoryId),
  ],
);

// Buku besar stok: setiap pergerakan stok satu baris, tidak pernah di-update
// atau dihapus. products.stock dan products.cost_price bisa dihitung ulang
// dari sini. Jenis mutasi: lib/stock.ts (STOCK_MOVEMENT_TYPES).
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: id(),
    storeId: storeRef(),
    productId: varchar("product_id", { length: 36 })
      .notNull()
      .references(() => products.id),
    type: varchar("type", { length: 20 }).notNull(),
    // Bertanda: + masuk, − keluar.
    qty: integer("qty").notNull(),
    // Snapshot products.stock setelah baris ini; mempermudah audit.
    stockAfter: integer("stock_after").notNull(),
    // Harga modal barang saat mutasi dibuat (setelah dihitung ulang, bila pembelian).
    costPrice: rupiah("cost_price").notNull(),
    // Dokumen pemicu: "purchases", "sales", "stock_takes"; null untuk INITIAL.
    referenceTable: varchar("reference_table", { length: 30 }),
    referenceId: varchar("reference_id", { length: 36 }),
    note: varchar("note", { length: 255 }),
    createdById: userRef("created_by_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("stock_movements_product_idx").on(t.storeId, t.productId, t.createdAt),
    index("stock_movements_reference_idx").on(t.referenceTable, t.referenceId),
    check(
      "stock_movements_type_check",
      sql`${t.type} IN ('INITIAL', 'PURCHASE', 'PURCHASE_VOID', 'SALE', 'SALE_VOID', 'STOCK_TAKE')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Infrastruktur
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Langganan & pengaturan platform (docs/DATABASE-SCHEMA.md §8, BUSINESS-FLOW §14)
// ---------------------------------------------------------------------------

// Satu baris saja (id = "default"): kontak admin, rekening pembayaran, gambar
// QRIS statis, masa gratis & tenggang. Diubah Superadmin di menu Pengaturan.
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  // Nomor WhatsApp admin SakuDagang (format 62…), tujuan konfirmasi bayar.
  adminPhone: varchar("admin_phone", { length: 20 }),
  bankName: varchar("bank_name", { length: 50 }),
  bankAccountNumber: varchar("bank_account_number", { length: 50 }),
  bankAccountName: varchar("bank_account_name", { length: 100 }),
  // Key file gambar QRIS statis di lib/storage.ts; null = belum diunggah.
  qrisImageKey: varchar("qris_image_key", { length: 255 }),
  freeDays: integer("free_days").notNull().default(14),
  graceDays: integer("grace_days").notNull().default(3),
  updatedAt: updatedAt(),
});

// Paket standar: harga TOTAL per periode (1, 6, 12 bulan). 0 = belum diatur.
export const subscriptionPlans = pgTable("subscription_plans", {
  id: id(),
  months: smallint("months").notNull().unique(),
  price: rupiah("price").notNull().default(0),
  updatedAt: updatedAt(),
});

// Harga khusus per toko (hasil negosiasi), menggantikan harga standar.
export const storePlanPrices = pgTable(
  "store_plan_prices",
  {
    id: id(),
    storeId: storeRef(),
    months: smallint("months").notNull(),
    price: rupiah("price").notNull(),
    note: varchar("note", { length: 255 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("store_plan_prices_store_months_idx").on(t.storeId, t.months)],
);

// Tagihan/langganan: satu baris per periode bayar. Harga = SNAPSHOT saat
// tagihan dibuat. Status: PENDING (menunggu bayar), ACTIVE (lunas, periode
// terisi), CANCELLED. "Habis" tidak disimpan: dihitung dari ends_at.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    storeId: storeRef(),
    months: smallint("months").notNull(),
    price: rupiah("price").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    // Periode terisi saat lunas: mulai dari akhir langganan yang sedang
    // berjalan (bila masih di masa depan) atau tanggal konfirmasi.
    startsAt: timestamptz("starts_at"),
    endsAt: timestamptz("ends_at"),
    paidAt: timestamptz("paid_at"),
    // Catatan: referensi transfer, keterangan admin, dll.
    note: varchar("note", { length: 255 }),
    createdById: userRef("created_by_id").notNull(),
    confirmedById: userRef("confirmed_by_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("subscriptions_store_idx").on(t.storeId),
    index("subscriptions_status_idx").on(t.status),
    check("subscriptions_status_check", sql`${t.status} IN ('PENDING', 'ACTIVE', 'CANCELLED')`),
  ],
);
