# Rancangan Skema Database SakuDagang

Rancangan tabel untuk v1, turunan dari [BUSINESS-FLOW.md](./BUSINESS-FLOW.md).
Setelah diimplementasi, sumber kebenaran adalah `src/lib/db/schema.ts`; dokumen
ini menjadi penjelasan "kenapa"-nya.

Konvensi (lihat [ARCHITECTURE.md](./ARCHITECTURE.md) §1 & §5):

- Nama tabel & kolom Bahasa Inggris, `snake_case`, tabel bentuk jamak (`products`, `sales`).
- `id` = `varchar(36)` UUID dibuat aplikasi. Semua waktu `timestamptz`. Uang `bigint` rupiah bulat. Qty `integer`.
- Kolom `created_at` di semua tabel; `updated_at` hanya di tabel yang bisa diedit.
- Kolom pelaku: `created_by_id` → `users.id`.
- **Multi-tenant:** semua tabel di §2–§7 punya `store_id` → `stores.id` (NOT NULL) sebagai kolom kedua setelah `id`, dan setiap index pencarian diawali `store_id`. Tidak ditulis ulang di tiap tabel di bawah agar ringkas. Unique constraint yang disebut "unique" berlaku **per toko**: `(store_id, name)`, `(store_id, number)`, dst.
- Status/enum disimpan `varchar` dengan daftar nilai di `features/*/constants.ts` (bukan enum PostgreSQL, agar menambah nilai tidak butuh migration).

Status: **§0, §1, dan §2 sudah diimplementasi (migration `0000`–`0005`); §3–§7 masih draf.**

---

## Peta tabel

```
stores ──< users
login_attempts

product_categories ──< products >──< stock_movements
                         │
      purchases >──< purchase_items
      sales >──< sale_items
      customers >──< sales (CREDIT) >──< credit_payments
      stock_takes >──< stock_take_items
      expense_categories ──< expenses
      document_sequences
```

---

## 0. Toko (tenant)

### `stores`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | varchar(36) PK | |
| name | varchar(100) | "Warung Bu Sri". |
| business_type | varchar(50) null | Jenis usaha, teks bebas: "Warung sembako", "Toko bangunan". |
| address, phone | varchar null | |
| timezone | varchar(50) default 'Asia/Jakarta' | Zona waktu toko; menentukan "hari ini" untuk laporan harian & void hari yang sama. `lib/dates.ts` perlu menerima zona per toko (saat ini membaca env `APP_TIMEZONE` sebagai bawaan). |
| is_active | boolean default true | Nonaktif = semua user toko tidak bisa login (langganan berhenti). |
| created_at, updated_at | | |

Dibuat dan dinonaktifkan oleh Superadmin. Langganan (v2) tidak disimpan di
tabel ini melainkan di tabel `plans` dan `subscriptions` (satu baris per
periode bayar), lihat BUSINESS-FLOW §14; `is_active` tetap menjadi saklar
tunggal yang dibaca saat login.

## 1. Akun

### `users`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | varchar(36) PK | |
| store_id | FK → stores null | Toko tempat user bekerja. **Null hanya untuk SUPERADMIN.** OWNER/CASHIER wajib terisi (dicek di action). Index. |
| role | varchar(20) | `SUPERADMIN`, `OWNER`, `CASHIER`. CHECK constraint; daftar nilai di `lib/auth/roles.ts`. |
| full_name | varchar(100) | |
| email | varchar(100) unique | Untuk login. |
| phone | varchar(20) null | Nomor WhatsApp format `62…` (`lib/phone.ts`), untuk mengirim undangan login via tautan click-to-chat. |
| password_hash | varchar(255) | bcrypt. |
| is_active | boolean default true | Nonaktif = tidak bisa login. |
| must_change_password | boolean default true | Password sementara dari pembuat akun. |
| session_version | integer default 1 | Dinaikkan saat ganti/reset password → semua perangkat logout. |
| created_at, updated_at | timestamptz | |

Satu user satu role; Owner tidak perlu role CASHIER karena haknya sudah mencakup. Email unik **global** (bukan per toko) karena email adalah identitas login.

**Kenapa `role` kolom varchar, bukan tabel `roles` + `user_roles`?** Template awal (ArchiPay) memakai many-to-many karena satu orang bisa merangkap dua role. SakuDagang tidak butuh itu, jadi disederhanakan (migration `0003_users_role_column`): tanpa join, tanpa seed data, dan konsisten dengan kolom status lain yang disimpan varchar dengan daftar nilai di `constants`. Kalau v2 butuh satu akun untuk banyak toko, bentuknya adalah `store_members (user_id, store_id, role)`, bukan `user_roles`.

Akun SUPERADMIN **tidak punya kolom khusus** di `users`; "tersembunyi"
diterapkan di query (`features/users/queries.ts` selalu mengecualikan user
yang punya role SUPERADMIN) dan di action (menolak target SUPERADMIN). Dengan
begitu tidak ada jalur lain untuk mengubahnya selain script.

### `login_attempts`

`id`, `email`, `ip_address varchar(45)`, `success boolean`, `created_at`. Untuk rate limit login. Index `(email, created_at)`, `(ip_address, created_at)`.

---

## 2. Barang & stok

### `product_categories`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| name | varchar(50) unique per toko | Sembako, Minuman, Rokok, … Disalin ke toko baru saat toko dibuat (bukan migration, karena per toko). |
| sort_order | smallint | Urutan tampil. |
| created_at | | |

### `products`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| name | varchar(100) unique | "Minyak Goreng 1 L". |
| category_id | FK → product_categories | |
| unit | varchar(20) | Label satuan: pcs, kg, bungkus. |
| cost_price | bigint | Harga modal rata-rata tertimbang. **Turunan** dari stock_movements; diubah hanya oleh pembelian / stok awal / pembatalan pembelian. |
| selling_price | bigint | Harga jual, diatur pemilik. |
| stock | integer default 0 | **Turunan** dari Σ stock_movements.qty. Boleh negatif. |
| min_stock | integer null | Untuk daftar "perlu restock". |
| is_active | boolean default true | |
| created_at, updated_at | | |

Index: `(is_active, name)` untuk pencarian kasir; `category_id`.

### `stock_movements` (ledger)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| product_id | FK → products | |
| type | varchar(20) | `INITIAL`, `PURCHASE`, `PURCHASE_VOID`, `SALE`, `SALE_VOID`, `STOCK_TAKE`. |
| qty | integer | Bertanda: + masuk, − keluar. |
| stock_after | integer | Snapshot `products.stock` setelah baris ini; mempermudah audit. |
| cost_price | bigint | Harga modal barang saat mutasi dibuat (setelah dihitung ulang, bila pembelian). |
| reference_table | varchar(30) | `purchases`, `sales`, `stock_takes`, atau null untuk INITIAL. |
| reference_id | varchar(36) null | Id dokumen pemicu. |
| created_by_id | FK → users | |
| created_at | | |

Index: `(product_id, created_at)`; `(reference_table, reference_id)`.

Aturan: tidak pernah di-update atau dihapus. Koreksi = baris baru.

---

## 3. Pembelian (barang masuk)

### `purchases`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| number | varchar(20) unique | `BL-2026-10-0001`. |
| period_year, period_month | smallint | Untuk filter & nomor. |
| date | date | Tanggal belanja (bisa beda dari created_at bila dicatat belakangan). |
| note | varchar(500) null | "Belanja di grosir Pak Haji". |
| total | bigint | Σ item.subtotal. Snapshot. |
| status | varchar(20) | `COMPLETED`, `VOIDED`. |
| void_reason | varchar(500) null | |
| voided_by_id, voided_at | FK, timestamptz null | |
| created_by_id | FK → users | |
| created_at | | |

### `purchase_items`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| purchase_id | FK → purchases | |
| product_id | FK → products | |
| product_name | varchar(100) | Snapshot. |
| qty | integer > 0 | |
| unit_cost | bigint | Harga beli per satuan. |
| subtotal | bigint | unit_cost × qty. |
| cost_price_before | bigint | Jejak perhitungan rata-rata. |
| cost_price_after | bigint | |
| new_selling_price | bigint null | Bila pemilik mengubah harga jual saat restock. |

Unique `(purchase_id, product_id)`: satu barang satu baris per pembelian.

---

## 4. Penjualan (kasir)

### `customers`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| name | varchar(100) | Tidak unique (bisa ada dua "Bu Sri"); UI memperingatkan nama sama. |
| phone | varchar(20) null | Format 62…, lihat `lib/phone.ts` ArchiPay bila diperlukan. |
| note | varchar(500) null | "Rumah sebelah masjid". |
| allow_credit | boolean default true | Boleh bon atau tidak. |
| created_at, updated_at | | |

### `sales`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| number | varchar(20) unique | `JL-2026-10-0001`. |
| period_year, period_month | smallint | |
| date | date | Tanggal kalender menurut APP_TIMEZONE; kunci laporan harian & aturan "hari yang sama". |
| payment_method | varchar(10) | `CASH`, `QRIS`, `CREDIT`. |
| customer_id | FK null | Wajib bila CREDIT. CHECK: `payment_method <> 'CREDIT' OR customer_id IS NOT NULL`. |
| total | bigint | Σ item.subtotal. |
| total_cost | bigint | Σ item.cost_price × qty = HPP transaksi. |
| total_gross_profit | bigint | total − total_cost. |
| cash_received | bigint null | Hanya CASH; kembalian = cash_received − total. |
| payment_status | varchar(15) | `PAID` (CASH/QRIS langsung), `UNPAID` (CREDIT). |
| status | varchar(15) | `COMPLETED`, `VOIDED`. |
| void_reason, voided_by_id, voided_at | | |
| created_by_id | FK → users | Kasir yang mencatat; dasar aturan "batalkan miliknya sendiri". |
| created_at | | |

Index: `(date, status)`; `(customer_id, payment_status)`; `created_by_id`.

### `sale_items`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| sale_id | FK | |
| product_id | FK | |
| product_name | varchar(100) | Snapshot. |
| qty | integer > 0 | |
| selling_price | bigint | Snapshot, boleh diubah kasir per transaksi. |
| cost_price | bigint | Snapshot. **Tidak pernah dikirim ke Kasir.** |
| subtotal | bigint | selling_price × qty. |
| gross_profit | bigint | (selling_price − cost_price) × qty. |

Index `(product_id)` untuk "barang terlaris". Unique `(sale_id, product_id)`.

### `credit_payments`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| sale_id | FK → sales (payment_method CREDIT) | Satu pelunasan → satu bon. |
| date | date | Tanggal uang diterima (dasar "uang masuk"). |
| amount | bigint > 0 | Boleh sebagian. Σ amount ≤ sales.total (dicek di action). |
| payment_method | varchar(10) | `CASH`, `QRIS`. |
| created_by_id | FK | |
| created_at | | |

Sisa bon = `sales.total − Σ credit_payments.amount`; bila 0 → `payment_status = PAID`. Sisa tidak disimpan, dihitung.

---

## 5. Pengeluaran operasional

### `expense_categories`

`id`, `store_id`, `name` unique per toko, `sort_order`, `created_at`. Disalin ke toko baru saat toko dibuat: Listrik & air, Transport, Kemasan/plastik, Gaji, Sewa, Lainnya.

### `expenses`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| date | date | |
| category_id | FK | |
| amount | bigint > 0 | |
| note | varchar(500) null | |
| created_by_id | FK | |
| created_at, updated_at | | Boleh diedit/dihapus (hard delete) oleh Pemilik. |

Index `(date)`.

---

## 6. Stok opname

### `stock_takes`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| number | varchar(20) unique | `SO-2026-10-0001`. |
| date | date | Tanggal opname (diisi saat selesai; saat draf = tanggal dibuat). |
| status | varchar(10) | `DRAFT`, `COMPLETED`. Hanya satu DRAFT (unique partial index `WHERE status = 'DRAFT'`). |
| note | varchar(500) null | |
| total_shrinkage | bigint null | Σ |selisih kurang| × cost_price, diisi saat COMPLETED. Snapshot untuk laporan. |
| completed_by_id, completed_at | | |
| created_by_id, created_at | | |

### `stock_take_items`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| stock_take_id | FK | |
| product_id | FK | |
| product_name | varchar(100) | Snapshot. |
| system_qty | integer | Diisi saat draf dibuat; **ditimpa ulang** saat COMPLETED dengan `products.stock` terkini. |
| physical_qty | integer null | null = belum dihitung → tidak diproses saat COMPLETED. |
| difference | integer null | physical_qty − system_qty (final saat COMPLETED). |
| reason | varchar(20) null | `DAMAGED`, `EXPIRED`, `LOST`, `PERSONAL_USE`, `MISCOUNT`, `OTHER`. Wajib bila difference ≠ 0. |
| note | varchar(255) null | |
| cost_price | bigint null | Snapshot saat COMPLETED, dasar penyusutan. |
| shrinkage_value | bigint null | |difference| × cost_price bila difference < 0, selain itu 0. |

Unique `(stock_take_id, product_id)`.

---

## 7. Penomoran

### `document_sequences`

| Kolom | Tipe | Keterangan |
|---|---|---|
| prefix | varchar(5) | `BL`, `JL`, `SO`. |
| period_year, period_month | smallint | |
| last_value | integer | |

PK gabungan `(store_id, prefix, period_year, period_month)`: nomor berjalan per toko. Diambil dengan `INSERT … ON CONFLICT DO UPDATE … RETURNING` di dalam transaksi yang sama dengan dokumennya (pola `lib/document-number.ts` ArchiPay), sehingga dua kasir yang menyimpan bersamaan tidak dapat nomor kembar.

---

## 7b. Langganan & pengaturan platform (BUSINESS-FLOW §14)

Sudah diimplementasi (migration `0006_subscriptions.sql`, 28 Okt 2026).

### `platform_settings`

Satu baris, `id = 'default'`, dibuat oleh migration. Diubah Superadmin di menu Pengaturan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| admin_phone | varchar(20) null | WhatsApp admin SakuDagang (62…), tujuan konfirmasi bayar. |
| bank_name, bank_account_number, bank_account_name | varchar null | Rekening transfer manual. |
| qris_image_key | varchar(255) null | Key gambar QRIS statis di `lib/storage.ts`; dilayani `/api/qris`. |
| free_days | integer default 14 | Masa gratis toko baru. |
| grace_days | integer default 3 | Masa tenggang setelah jatuh tempo. |

### `subscription_plans`

| Kolom | Tipe | Keterangan |
|---|---|---|
| months | smallint unique | 1, 6, 12 (seed migration). |
| price | bigint default 0 | Harga TOTAL per periode; 0 = belum diatur, paket tidak bisa dipilih. |

### `store_plan_prices`

Harga khusus per toko (negosiasi). Unique (`store_id`, `months`). Kolom `price`,
`note`. Bila ada, menggantikan harga standar untuk toko itu.

### `subscriptions`

Satu baris per tagihan/periode. Tidak pernah dihapus.

| Kolom | Tipe | Keterangan |
|---|---|---|
| store_id | FK stores | |
| months | smallint | Periode paket. |
| price | bigint | SNAPSHOT harga saat tagihan dibuat. |
| status | varchar(20) | `PENDING` menunggu bayar, `CLAIMED` pemilik sudah klik "saya sudah bayar" + bukti (menunggu konfirmasi), `ACTIVE` lunas, `CANCELLED`. CHECK constraint. "Habis" dihitung dari `ends_at`. |
| claimed_at, proof_key | timestamptz / varchar(255) null | Waktu klaim bayar & key bukti transfer di `lib/storage.ts` (dilayani `/api/subscriptions/[id]/proof`). Key diawali folder bulan `YYYY-MM/bukti-transfer/…` agar bukti lama bisa dibersihkan manual per bulan dari bucket R2; bila berkas sudah tidak ada, UI menampilkan "Transaksi sudah selesai" dan `proof_key` tetap tersimpan sebagai jejak. |
| rejected_at, rejection_note | timestamptz / varchar(255) null | Penolakan admin terakhir (alasan tampil ke pemilik); jejak bila ada perselisihan. |
| starts_at, ends_at | timestamptz null | Diisi saat lunas: mulai dari `stores.subscription_until` bila masih di masa depan, kalau tidak dari waktu konfirmasi. |
| paid_at | timestamptz null | Waktu ditandai lunas. |
| note | varchar(255) null | Referensi transfer / keterangan admin. |
| created_by_id, confirmed_by_id | FK users | Pembuat (Pemilik/Superadmin) dan yang mengonfirmasi (Superadmin). |

### `stores.subscription_until`, `stores.last_reminder_key`

`last_reminder_key` (varchar(20) null) = pengingat WhatsApp terakhir yang
sudah dikirim, format `<YYYY-MM-DD berakhir>:<H->`, agar cron harian tidak
mengirim dobel (`features/subscriptions/reminders.ts`).

Kolom tambahan di `stores`: akhir masa gratis/langganan. Diisi saat toko dibuat
(`now + free_days`) dan setiap tagihan lunas (di dalam transaksi dengan baris
toko dikunci). Dibaca `lib/auth/dal.ts` di setiap request: lewat
`subscription_until + grace_days` → toko terkunci (Pemilik hanya halaman
Langganan, Kasir tidak bisa login). Logika di `lib/subscription-access.ts`.

## 8. Query laporan (bukan tabel)

Semua angka laporan dihitung saat diminta dari tabel di atas, difilter
`status = 'COMPLETED'`. Ringkasan sumber tiap angka:

Semua query di bawah difilter `store_id` terlebih dahulu.

| Angka | Sumber |
|---|---|
| Omset, HPP, laba kotor | `sales` (SUM total, total_cost, total_gross_profit) per `date` |
| Pengeluaran | `expenses` per `date` |
| Penyusutan | `stock_takes.total_shrinkage` per `date` (status COMPLETED) |
| Uang masuk tunai/QRIS | `sales` metode CASH/QRIS + `credit_payments` per `date` |
| Uang keluar | `purchases.total` + `expenses.amount` |
| Bon baru | `sales` metode CREDIT per `date` |
| Piutang berjalan | `sales` CREDIT UNPAID: total − Σ credit_payments |
| Barang terlaris, laba per kategori | `sale_items` join `products`, `product_categories` |
| Perlu restock | `products` where `stock <= min_stock` or `stock < 0` |

Bila nanti laporan tahunan terasa lambat (ratusan ribu baris), index
`(date)` di `sales` sudah cukup untuk warung; agregat harian tersimpan
(materialized) adalah opsi v2.

---

## 9. Data awal (migration pertama)

- Tidak ada seed role: `users.role` adalah varchar dengan CHECK constraint.
- Akun Superadmin: lewat `pnpm db:create-superadmin <email> <password> "<Nama>"`, bukan migration.
- Per toko, diisi oleh action "buat toko" (`features/stores/actions.ts`), bukan migration:
  - `product_categories`: Sembako, Minuman, Makanan ringan, Rokok, Kebutuhan rumah, Lainnya.
  - `expense_categories`: Listrik & air, Transport, Kemasan/plastik, Gaji, Sewa, Lainnya.
- Akun Pemilik dibuat Superadmin dari halaman Toko/Pengguna.

---

## 10. Catatan desain

- **Kenapa `total_cost` disimpan di `sales`** padahal bisa dijumlah dari item? Supaya laporan harian/bulanan cukup SUM satu tabel tanpa join item. Nilainya snapshot dan tidak pernah berubah setelah disimpan, jadi aman.
- **Kenapa `products.stock` disimpan** padahal turunan ledger? Layar kasir membaca stok puluhan barang sekaligus; SUM ledger tiap kali tidak perlu. Konsistensi dijaga karena keduanya ditulis dalam transaksi yang sama. Sediakan script `pnpm db:recalculate-stock` untuk memverifikasi/memperbaiki.
- **Kenapa pembatalan bukan hapus?** Riwayat & nomor dokumen harus tetap utuh untuk audit pemilik.
- **Kenapa status bukan enum PostgreSQL?** Menambah nilai status jadi perubahan kode saja, bukan migration `ALTER TYPE`.
