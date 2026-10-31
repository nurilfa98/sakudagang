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
  date,
  index,
  integer,
  pgTable,
  primaryKey,
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
// Pembelian / barang masuk (docs/DATABASE-SCHEMA.md §3, BUSINESS-FLOW §4)
// ---------------------------------------------------------------------------

// Satu kali belanja stok. Tidak bisa diedit; salah input = batalkan (VOIDED)
// lalu buat yang baru. Total = SNAPSHOT Σ item.subtotal.
export const purchases = pgTable(
  "purchases",
  {
    id: id(),
    storeId: storeRef(),
    // "BL-2026-10-0001", berjalan per toko per bulan (lib/document-number.ts).
    number: varchar("number", { length: 20 }).notNull(),
    periodYear: smallint("period_year").notNull(),
    periodMonth: smallint("period_month").notNull(),
    // Tanggal belanja; boleh lebih awal dari created_at bila dicatat belakangan.
    date: date("date").notNull(),
    note: varchar("note", { length: 500 }),
    total: rupiah("total").notNull(),
    // COMPLETED atau VOIDED (features/purchases/constants.ts).
    status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
    voidReason: varchar("void_reason", { length: 500 }),
    voidedById: userRef("voided_by_id"),
    voidedAt: timestamptz("voided_at"),
    createdById: userRef("created_by_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("purchases_store_number_idx").on(t.storeId, t.number),
    index("purchases_store_date_idx").on(t.storeId, t.date),
    check("purchases_status_check", sql`${t.status} IN ('COMPLETED', 'VOIDED')`),
  ],
);

// Baris pembelian. Nama barang & harga modal sebelum/sesudah disimpan sebagai
// jejak perhitungan rata-rata tertimbang.
export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: id(),
    storeId: storeRef(),
    purchaseId: varchar("purchase_id", { length: 36 })
      .notNull()
      .references(() => purchases.id),
    productId: varchar("product_id", { length: 36 })
      .notNull()
      .references(() => products.id),
    productName: varchar("product_name", { length: 100 }).notNull(),
    qty: integer("qty").notNull(),
    // Harga beli per satuan.
    unitCost: rupiah("unit_cost").notNull(),
    subtotal: rupiah("subtotal").notNull(),
    costPriceBefore: rupiah("cost_price_before").notNull(),
    costPriceAfter: rupiah("cost_price_after").notNull(),
    // Harga jual baru yang diisi saat restock; null = harga jual tidak diubah.
    newSellingPrice: rupiah("new_selling_price"),
  },
  (t) => [
    // Satu barang satu baris per pembelian.
    uniqueIndex("purchase_items_purchase_product_idx").on(t.purchaseId, t.productId),
    index("purchase_items_product_idx").on(t.storeId, t.productId),
    check("purchase_items_qty_check", sql`${t.qty} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Penjualan / kasir & pelanggan (docs/DATABASE-SCHEMA.md §4, BUSINESS-FLOW §5–§6)
// ---------------------------------------------------------------------------

// Pelanggan, terutama untuk bon (piutang). Nama tidak unik: bisa ada dua
// "Bu Sri"; UI memperingatkan nama sama. Kasir boleh menambah dari layar kasir.
export const customers = pgTable(
  "customers",
  {
    id: id(),
    storeId: storeRef(),
    name: varchar("name", { length: 100 }).notNull(),
    // Nomor WhatsApp format 62… (lib/phone.ts), opsional.
    phone: varchar("phone", { length: 20 }),
    note: varchar("note", { length: 500 }),
    // false = pemilik menandai pelanggan ini tidak boleh bon.
    allowCredit: boolean("allow_credit").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("customers_store_name_idx").on(t.storeId, t.name)],
);

// Satu transaksi kasir. Tidak bisa diedit; salah input = batalkan (VOIDED).
// total, total_cost (HPP), dan total_gross_profit disimpan agar laporan
// cukup SUM satu tabel (DATABASE-SCHEMA §10); nilainya snapshot.
export const sales = pgTable(
  "sales",
  {
    id: id(),
    storeId: storeRef(),
    // "JL-2026-10-0001", berjalan per toko per bulan (lib/document-number.ts).
    number: varchar("number", { length: 20 }).notNull(),
    periodYear: smallint("period_year").notNull(),
    periodMonth: smallint("period_month").notNull(),
    // Tanggal kalender menurut zona waktu toko saat disimpan: kunci laporan
    // harian & aturan "Kasir membatalkan hanya di hari yang sama".
    date: date("date").notNull(),
    // CASH, QRIS, CREDIT (bon) — features/sales/constants.ts.
    paymentMethod: varchar("payment_method", { length: 10 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }).references(() => customers.id),
    total: rupiah("total").notNull(),
    totalCost: rupiah("total_cost").notNull(),
    totalGrossProfit: rupiah("total_gross_profit").notNull(),
    // Hanya CASH: uang dari pembeli; kembalian = cash_received − total.
    cashReceived: rupiah("cash_received"),
    // PAID (tunai/QRIS langsung lunas) atau UNPAID (bon, menjadi piutang).
    paymentStatus: varchar("payment_status", { length: 15 }).notNull(),
    // COMPLETED atau VOIDED.
    status: varchar("status", { length: 15 }).notNull().default("COMPLETED"),
    voidReason: varchar("void_reason", { length: 500 }),
    voidedById: userRef("voided_by_id"),
    voidedAt: timestamptz("voided_at"),
    // Kasir yang mencatat; dasar aturan "batalkan miliknya sendiri".
    createdById: userRef("created_by_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sales_store_number_idx").on(t.storeId, t.number),
    index("sales_store_date_idx").on(t.storeId, t.date, t.status),
    index("sales_store_customer_idx").on(t.storeId, t.customerId, t.paymentStatus),
    index("sales_created_by_idx").on(t.createdById),
    check("sales_payment_method_check", sql`${t.paymentMethod} IN ('CASH', 'QRIS', 'CREDIT')`),
    check("sales_payment_status_check", sql`${t.paymentStatus} IN ('PAID', 'UNPAID')`),
    check("sales_status_check", sql`${t.status} IN ('COMPLETED', 'VOIDED')`),
    // Bon wajib punya pelanggan.
    check("sales_credit_customer_check", sql`${t.paymentMethod} <> 'CREDIT' OR ${t.customerId} IS NOT NULL`),
  ],
);

// Baris penjualan: SNAPSHOT harga & nama saat transaksi, bukan referensi ke
// master, agar laporan lama tidak berubah saat harga/nama barang diganti.
// cost_price tidak pernah dikirim ke Kasir.
export const saleItems = pgTable(
  "sale_items",
  {
    id: id(),
    storeId: storeRef(),
    saleId: varchar("sale_id", { length: 36 })
      .notNull()
      .references(() => sales.id),
    productId: varchar("product_id", { length: 36 })
      .notNull()
      .references(() => products.id),
    productName: varchar("product_name", { length: 100 }).notNull(),
    qty: integer("qty").notNull(),
    sellingPrice: rupiah("selling_price").notNull(),
    costPrice: rupiah("cost_price").notNull(),
    subtotal: rupiah("subtotal").notNull(),
    grossProfit: rupiah("gross_profit").notNull(),
  },
  (t) => [
    uniqueIndex("sale_items_sale_product_idx").on(t.saleId, t.productId),
    // Barang terlaris & riwayat jual per barang.
    index("sale_items_product_idx").on(t.storeId, t.productId),
    check("sale_items_qty_check", sql`${t.qty} > 0`),
  ],
);

// Pelunasan bon (BUSINESS-FLOW §6): satu baris = satu kali bayar untuk SATU
// penjualan bon, boleh sebagian. Σ pelunasan COMPLETED ≥ sales.total →
// sales.payment_status = PAID. Uang masuk dihitung pada `date` (tanggal uang
// diterima), bukan omset (omset sudah dihitung saat jual). Salah catat =
// dibatalkan (VOIDED), tidak dihapus; selama ada pelunasan COMPLETED,
// penjualannya tidak bisa dibatalkan.
export const creditPayments = pgTable(
  "credit_payments",
  {
    id: id(),
    storeId: storeRef(),
    saleId: varchar("sale_id", { length: 36 })
      .notNull()
      .references(() => sales.id),
    // Disalin dari sales.customer_id agar riwayat per pelanggan tidak perlu join.
    customerId: varchar("customer_id", { length: 36 })
      .notNull()
      .references(() => customers.id),
    date: date("date").notNull(),
    amount: rupiah("amount").notNull(),
    // CASH atau QRIS.
    paymentMethod: varchar("payment_method", { length: 10 }).notNull(),
    // COMPLETED atau VOIDED.
    status: varchar("status", { length: 15 }).notNull().default("COMPLETED"),
    voidReason: varchar("void_reason", { length: 500 }),
    voidedById: userRef("voided_by_id"),
    voidedAt: timestamptz("voided_at"),
    createdById: userRef("created_by_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("credit_payments_sale_idx").on(t.storeId, t.saleId),
    index("credit_payments_customer_idx").on(t.storeId, t.customerId),
    index("credit_payments_date_idx").on(t.storeId, t.date),
    check("credit_payments_amount_check", sql`${t.amount} > 0`),
    check("credit_payments_method_check", sql`${t.paymentMethod} IN ('CASH', 'QRIS')`),
    check("credit_payments_status_check", sql`${t.status} IN ('COMPLETED', 'VOIDED')`),
  ],
);

// ---------------------------------------------------------------------------
// Pengeluaran operasional (docs/DATABASE-SCHEMA.md §5, BUSINESS-FLOW §7)
// ---------------------------------------------------------------------------

// Kategori pengeluaran per toko. Diisi awal saat toko dibuat
// (lib/store-defaults.ts), pemilik bisa menambah/mengubah.
export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: id(),
    storeId: storeRef(),
    name: varchar("name", { length: 50 }).notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("expense_categories_store_name_idx").on(t.storeId, t.name)],
);

// Biaya di luar belanja stok (listrik, plastik, bensin, gaji). Mengurangi
// laba bersih pada `date`. Bukan transaksi stok, jadi boleh diedit/dihapus
// (hard delete) oleh Pemilik tanpa efek berantai.
export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    storeId: storeRef(),
    date: date("date").notNull(),
    categoryId: varchar("category_id", { length: 36 })
      .notNull()
      .references(() => expenseCategories.id),
    amount: rupiah("amount").notNull(),
    note: varchar("note", { length: 500 }),
    createdById: userRef("created_by_id").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("expenses_store_date_idx").on(t.storeId, t.date),
    index("expenses_category_idx").on(t.categoryId),
    check("expenses_amount_check", sql`${t.amount} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Stok opname (docs/DATABASE-SCHEMA.md §6, BUSINESS-FLOW §9)
// ---------------------------------------------------------------------------

// Pencocokan stok fisik dengan sistem. DRAFT (sedang dihitung, hanya satu per
// toko) → COMPLETED (stok diluruskan, penyusutan dicatat; tidak bisa diubah).
export const stockTakes = pgTable(
  "stock_takes",
  {
    id: id(),
    storeId: storeRef(),
    // "SO-2026-10-0001", berjalan per toko per bulan (lib/document-number.ts).
    number: varchar("number", { length: 20 }).notNull(),
    // Saat draf = tanggal dibuat; diisi ulang dengan tanggal selesai.
    date: date("date").notNull(),
    status: varchar("status", { length: 10 }).notNull().default("DRAFT"),
    note: varchar("note", { length: 500 }),
    // Σ |selisih kurang| × harga modal, diisi saat COMPLETED. Snapshot untuk
    // laporan (mengurangi laba bersih pada `date`).
    totalShrinkage: rupiah("total_shrinkage"),
    completedById: userRef("completed_by_id"),
    completedAt: timestamptz("completed_at"),
    createdById: userRef("created_by_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("stock_takes_store_number_idx").on(t.storeId, t.number),
    // Hanya boleh ada satu opname DRAFT per toko.
    uniqueIndex("stock_takes_store_draft_idx").on(t.storeId).where(sql`${t.status} = 'DRAFT'`),
    index("stock_takes_store_date_idx").on(t.storeId, t.date),
    check("stock_takes_status_check", sql`${t.status} IN ('DRAFT', 'COMPLETED')`),
  ],
);

// Satu baris per barang aktif saat opname dibuat. physical_qty null = belum
// dihitung → tidak diproses saat diselesaikan.
export const stockTakeItems = pgTable(
  "stock_take_items",
  {
    id: id(),
    storeId: storeRef(),
    stockTakeId: varchar("stock_take_id", { length: 36 })
      .notNull()
      .references(() => stockTakes.id),
    productId: varchar("product_id", { length: 36 })
      .notNull()
      .references(() => products.id),
    productName: varchar("product_name", { length: 100 }).notNull(),
    // Diisi saat draf dibuat; DITIMPA dengan products.stock terkini saat
    // diselesaikan (penjualan tetap berjalan selama opname).
    systemQty: integer("system_qty").notNull(),
    physicalQty: integer("physical_qty"),
    // physical_qty − system_qty, final saat COMPLETED.
    difference: integer("difference"),
    // DAMAGED, EXPIRED, LOST, PERSONAL_USE, MISCOUNT, OTHER; wajib bila selisih ≠ 0.
    reason: varchar("reason", { length: 20 }),
    note: varchar("note", { length: 255 }),
    // Snapshot saat COMPLETED, dasar penyusutan.
    costPrice: rupiah("cost_price"),
    // |selisih| × harga modal bila selisih < 0, selain itu 0.
    shrinkageValue: rupiah("shrinkage_value"),
  },
  (t) => [
    uniqueIndex("stock_take_items_take_product_idx").on(t.stockTakeId, t.productId),
    check(
      "stock_take_items_reason_check",
      sql`${t.reason} IS NULL OR ${t.reason} IN ('DAMAGED', 'EXPIRED', 'LOST', 'PERSONAL_USE', 'MISCOUNT', 'OTHER')`,
    ),
  ],
);

// Penomoran dokumen berjalan per toko, per jenis (BL/JL/SO), per bulan.
// Diambil dengan INSERT … ON CONFLICT DO UPDATE … RETURNING di transaksi yang
// sama dengan dokumennya, sehingga dua penyimpanan bersamaan tidak mendapat
// nomor kembar (lib/document-number.ts).
export const documentSequences = pgTable(
  "document_sequences",
  {
    storeId: storeRef(),
    prefix: varchar("prefix", { length: 5 }).notNull(),
    periodYear: smallint("period_year").notNull(),
    periodMonth: smallint("period_month").notNull(),
    lastValue: integer("last_value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.prefix, t.periodYear, t.periodMonth] })],
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

// Satu baris saja (id = "default"): kontak admin, gambar QRIS statis, masa
// gratis & tenggang. Diubah Superadmin di menu Pengaturan. Rekening bank ada
// di payment_bank_accounts (bisa lebih dari satu).
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  // Nomor WhatsApp admin SakuDagang (format 62…), tujuan konfirmasi bayar.
  adminPhone: varchar("admin_phone", { length: 20 }),
  // Key file gambar QRIS statis di lib/storage.ts; null = belum diunggah.
  qrisImageKey: varchar("qris_image_key", { length: 255 }),
  freeDays: integer("free_days").notNull().default(14),
  graceDays: integer("grace_days").notNull().default(3),
  // Diskon (%) paket 6 bulan & 1 tahun dibanding harga per bulan. Harga paket
  // di subscription_plans dihitung dari harga 1 bulan + diskon ini saat
  // Superadmin menyimpan Harga paket (features/subscriptions/pricing.ts).
  discount6: integer("discount_6").notNull().default(10),
  discount12: integer("discount_12").notNull().default(20),
  updatedAt: updatedAt(),
});

// Rekening bank tujuan transfer langganan (Pengaturan): boleh banyak, nama
// bank bebas, boleh kosong (pemilik hanya melihat QRIS). Nomor disimpan
// angka saja; strip mengikuti pola bank saat ditampilkan (lib/bank.ts).
export const paymentBankAccounts = pgTable("payment_bank_accounts", {
  id: id(),
  bankName: varchar("bank_name", { length: 50 }).notNull(),
  accountNumber: varchar("account_number", { length: 50 }).notNull(),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  createdAt: createdAt(),
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
// tagihan dibuat. Baris baru tercipta saat pemilik menekan "Saya sudah bayar"
// (langsung CLAIMED) atau admin mencatat pembayaran langsung (ACTIVE); memilih
// paket saja tidak menyimpan apa pun. Bukti & nominal tiap transfer ada di
// subscription_payments (satu tagihan bisa dibayar beberapa kali).
// Status: CLAIMED (ada pembayaran menunggu konfirmasi admin), UNDERPAID
// (kurang bayar: diterima < harga, pemilik perlu melengkapi), ACTIVE (lunas,
// periode terisi), REJECTED (ditolak admin, status akhir). PENDING dan
// CANCELLED hanya untuk baris lama sebelum 29 Okt 2026. "Habis" tidak
// disimpan: dihitung dari ends_at. Hanya ACTIVE yang memperpanjang masa toko
// (BUSINESS-FLOW §14.2).
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
    // Total yang sudah diterima admin (Σ subscription_payments ACCEPTED).
    // Lunas bila ≥ price. Disimpan agar daftar tidak perlu menjumlah ulang.
    amountPaid: rupiah("amount_paid").notNull().default(0),
    // Catatan: referensi transfer, keterangan admin, dll.
    note: varchar("note", { length: 255 }),
    // Penolakan akhir oleh admin (dana tidak masuk / bukti palsu): waktu +
    // alasan, tampil ke pemilik dan tersimpan sebagai jejak bila ada perselisihan.
    rejectedAt: timestamptz("rejected_at"),
    rejectionNote: varchar("rejection_note", { length: 255 }),
    createdById: userRef("created_by_id").notNull(),
    confirmedById: userRef("confirmed_by_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("subscriptions_store_idx").on(t.storeId),
    index("subscriptions_status_idx").on(t.status),
    check(
      "subscriptions_status_check",
      sql`${t.status} IN ('PENDING', 'CLAIMED', 'UNDERPAID', 'ACTIVE', 'REJECTED', 'CANCELLED')`,
    ),
  ],
);

// Pembayaran per tagihan: satu baris per bukti transfer yang dikirim pemilik
// (atau pencatatan langsung oleh admin). Admin memeriksa bukti lalu mengisi
// nominal yang benar-benar masuk (amount_received); bila kurang dari harga,
// tagihan menjadi UNDERPAID dan pemilik mengirim bukti berikutnya pada
// tagihan yang sama. Baris tidak pernah dihapus (jejak).
export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: id(),
    subscriptionId: varchar("subscription_id", { length: 36 })
      .notNull()
      .references(() => subscriptions.id),
    storeId: storeRef(),
    // PENDING (menunggu admin), ACCEPTED (nominal diakui), REJECTED (ditolak).
    status: varchar("status", { length: 20 }).notNull(),
    // Key bukti transfer di lib/storage.ts, awalan folder bulan "YYYY-MM/".
    // Null hanya untuk pencatatan langsung oleh admin (tanpa bukti).
    proofKey: varchar("proof_key", { length: 255 }),
    // Catatan pemilik saat mengirim (bank pengirim, jam transfer).
    note: varchar("note", { length: 255 }),
    // Diisi admin saat memeriksa: nominal yang masuk + keterangan/alasan tolak.
    amountReceived: rupiah("amount_received"),
    reviewNote: varchar("review_note", { length: 255 }),
    reviewedAt: timestamptz("reviewed_at"),
    reviewedById: userRef("reviewed_by_id"),
    createdById: userRef("created_by_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("subscription_payments_subscription_idx").on(t.subscriptionId),
    index("subscription_payments_status_idx").on(t.status),
    check("subscription_payments_status_check", sql`${t.status} IN ('PENDING', 'ACCEPTED', 'REJECTED')`),
  ],
);
