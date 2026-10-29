# Arsitektur SakuDagang

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Cache Components aktif.
Struktur dan pola dev mengikuti ArchiPay; aturan bisnis ada di
[BUSINESS-FLOW.md](./BUSINESS-FLOW.md), rancangan tabel di
[DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md).

## 1. Struktur folder

```
sakusembako/
├── database/migrations/       # migration SQL hasil drizzle-kit
├── docs/                      # dokumentasi seperti file ini
├── public/                    # file statis (logo, gambar)
├── scripts/                   # create-superadmin.mjs (akun developer, tersembunyi)
├── src/
│   ├── app/                   # ROUTING SAJA — tipis, tidak ada logika bisnis
│   │   ├── (auth)/layout.tsx               # tampilan tengah tanpa sidebar
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/change-password/page.tsx
│   │   ├── (app)/layout.tsx                # sidebar + navbar setelah login
│   │   ├── (app)/page.tsx                  # beranda: dashboard Pemilik / beranda Kasir
│   │   ├── (app)/cashier/page.tsx          # layar penjualan (kasir)
│   │   ├── (app)/sales/page.tsx            # riwayat penjualan
│   │   ├── (app)/sales/[id]/page.tsx
│   │   ├── (app)/credits/page.tsx          # piutang (bon) per pelanggan
│   │   ├── (app)/customers/page.tsx
│   │   ├── (app)/products/page.tsx         # master barang & stok
│   │   ├── (app)/products/new/page.tsx
│   │   ├── (app)/products/[id]/page.tsx
│   │   ├── (app)/purchases/page.tsx        # barang masuk
│   │   ├── (app)/purchases/new/page.tsx
│   │   ├── (app)/purchases/[id]/page.tsx
│   │   ├── (app)/expenses/page.tsx         # pengeluaran operasional
│   │   ├── (app)/stock-takes/page.tsx      # stok opname
│   │   ├── (app)/stock-takes/[id]/page.tsx
│   │   ├── (app)/reports/daily/page.tsx    # laporan harian
│   │   ├── (app)/reports/monthly/page.tsx
│   │   ├── (app)/reports/yearly/page.tsx
│   │   ├── (app)/users/page.tsx            # pengguna
│   │   ├── (app)/stores/page.tsx           # daftar toko (Superadmin) / data toko sendiri (Pemilik)
│   │   ├── api/reports/export/route.ts     # unduh Excel
│   │   ├── api/cron/...                    # job terjadwal (bila nanti perlu)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── features/              # LOGIKA PER DOMAIN BISNIS
│   │   ├── auth/              # login, logout, ganti password
│   │   ├── stores/            # toko (tenant): buat, ubah, nonaktifkan; isi kategori awal
│   │   ├── users/             # akun Pemilik & Kasir (Superadmin selalu dikecualikan di queries)
│   │   ├── products/          # master barang, kategori, harga modal rata-rata
│   │   ├── purchases/         # barang masuk
│   │   ├── sales/             # kasir, pembatalan
│   │   ├── credits/           # pelanggan, piutang (bon), pelunasan
│   │   ├── expenses/          # biaya operasional
│   │   ├── stock-takes/       # stok opname
│   │   └── reports/           # agregasi harian/bulanan/tahunan, dashboard
│   ├── components/            # UI yang dipakai lintas fitur
│   │   ├── ui/                # shadcn/ui (Base UI)
│   │   ├── data-table/        # tabel generik (tanstack)
│   │   ├── theme/             # tema terang/gelap
│   │   └── layout/            # AppSidebar, AppHeader, nav-config.ts (daftar menu)
│   ├── hooks/                 # React hooks bersama (use-mobile)
│   ├── lib/                   # infrastruktur (bukan logika bisnis)
│   │   ├── db/                # koneksi + schema database
│   │   ├── auth/              # password, session, dal, roles, permissions (RBAC)
│   │   ├── stock.ts           # recordStockMovement(), dipakai purchases/sales/stock-takes
│   │   ├── document-number.ts # nomor BL-/JL-/SO- per bulan
│   │   ├── excel.ts           # xlsxResponse() untuk ekspor laporan
│   │   ├── request.ts         # getClientIp()
│   │   ├── env.ts             # validasi environment variable
│   │   ├── dates.ts           # tanggal menurut APP_TIMEZONE
│   │   └── format.ts          # formatRupiah, dll
│   ├── types/                 # tipe global (ActionResult)
│   └── proxy.ts               # (Next 16: pengganti middleware.ts) redirect cepat ke /login
```

### Bahasa penamaan

| Hal | Bahasa | Contoh |
|---|---|---|
| Kode: nama tabel & kolom, folder `features/`, URL, permission, fungsi, variabel, nilai status | **Inggris** | `features/sales`, tabel `sale_items`, `/stock-takes`, `product:view-cost`, `createSale()`, status `VOIDED` |
| Teks yang dilihat user: label menu, judul halaman, tombol, pesan error, email | **Indonesia** | "Stok Opname", "Simpan transaksi", "Email atau password salah." |
| Komentar kode & dokumentasi di `docs/` | Indonesia | |
| Data yang dilihat user (nomor dokumen, nama kategori awal) | Indonesia | `JL-2026-10-0001`, kategori "Sembako" |

Istilah domain yang dipakai di kode (dari BUSINESS-FLOW.md):

| Istilah bisnis | Di kode |
|---|---|
| Barang, kategori barang | `product`, `product_category` |
| Harga modal, harga jual | `cost_price`, `selling_price` |
| Pembelian (barang masuk) | `purchase` |
| Penjualan, kasir | `sale`, `cashier` |
| Bon / piutang, pelunasan | `credit`, `credit_payment` |
| Pelanggan | `customer` |
| Pengeluaran | `expense` |
| Mutasi stok | `stock_movement` |
| Stok opname | `stock_take` |
| Penyusutan | `shrinkage` |
| Pembatalan (void) | `void` |
| HPP, laba kotor, laba bersih | `total_cost`, `gross_profit`, `net_profit` |

## 2. Isi satu folder fitur

```
features/sales/
├── components/        # cashier-form.tsx, sales-table.tsx ("use client" bila perlu)
├── constants.ts       # SALE_STATUSES, PAYMENT_METHODS
├── schemas.ts         # zod: validasi input form (dipakai client & server)
├── service.ts         # aturan bisnis MURNI (tanpa DB, tanpa Next) → mudah dites
├── queries.ts         # baca data (server-only): cek session → query DB → DTO
└── actions.ts         # "use server": validasi → otorisasi → service → simpan → revalidate
```

### Arah dependensi (aturan paling penting)

```
app/  ──►  features/  ──►  lib/
```

- `app/` boleh import dari `features/` dan `components/`.
- `features/` boleh import dari `lib/`, `components/`, `types/`.
- `lib/` tidak boleh import dari `features/` atau `app/`.
- Satu fitur sebaiknya tidak import isi internal fitur lain. Yang dipakai
  bersama dipindah ke `lib/`. Contoh: pencatatan mutasi stok dipakai
  `purchases`, `sales`, dan `stock-takes` → `lib/stock.ts`.
- Hindari barrel file (`index.ts` yang re-export semua).

## 3. Alur data

### Membaca data (Server Component)

```
page.tsx (Server Component)
   └─► features/products/queries.ts    import "server-only"
          ├─ requireStore("product:view")        ← lib/auth/dal.ts, memberi storeId
          ├─ query DB where store_id = storeId   ← lib/db
          └─ return DTO                          ← hanya field yang dibutuhkan UI
```

**Multi-tenant.** Semua tabel bisnis punya `store_id`. `requireStore()`
mengembalikan user beserta `storeId` yang pasti terisi; query **selalu**
menambahkan `eq(table.storeId, storeId)`, termasuk saat mengambil satu baris
berdasarkan id (`where(and(eq(t.id, id), eq(t.storeId, storeId)))`). Id dari
URL/form tidak pernah dipercaya untuk menentukan toko.

DTO penting di sini karena **Kasir tidak boleh melihat harga modal**: query
untuk layar kasir tidak boleh mengembalikan kolom `cost_price` sama sekali,
bukan sekadar disembunyikan di UI.

### Daftar data: paket standar data table

Setiap halaman daftar memakai satu paket yang sama (disalin dari archipay,
`src/components/data-table/`), sehingga fitur baru tinggal mengikuti pola:

| Bagian | File | Isi |
|---|---|---|
| Skema filter | `features/<fitur>/schemas.ts` | `parse<Fitur>Filters(searchParams)` dengan zod: nilai URL tidak valid diabaikan, bukan error. Helper umum (`firstParam`, tahun, bulan, enum) di `lib/filters.ts`. |
| Query | `features/<fitur>/queries.ts` | `list<Fitur>({ storeId, ...filters, limit })` menerapkan filter di SQL; `list<Fitur>FilterOptions()` untuk pilihan dropdown (tahun yang ada data, kategori, dst). |
| Tabel | `features/<fitur>/components/<fitur>-table.tsx` | Client Component. Kolom dibuat **di luar komponen** (`createDataTableColumns`), `DataTable` dengan `searchableColumns`, panel `DataTableFilters` + `DataTableFilterSelect`, nilai filter lewat `useUrlFilters()`. |
| Halaman | `app/(app)/<fitur>/page.tsx` | `searchParams` di-await di dalam `<Suspense>`, hasil parse diteruskan ke query dan ke tabel (`filters` + `activeFilterCount`). |

Pembagian kerja: **pencarian, urutan, dan halaman** (10 baris) berjalan di
browser atas data yang dimuat (batas 500 baris per query); **filter** (status,
bulan, kategori, …) disimpan di URL dan diterapkan server, jadi ikut tersimpan
saat refresh/bookmark. Bila satu daftar melewati ribuan baris, pindahkan
pencarian & halaman ke server (`manualPagination`) tanpa mengubah tampilan.

Penerapan ke tabel yang sudah ada:

| Tabel | Pencarian | Filter (URL) |
|---|---|---|
| Barang (`/products`) | nama, kategori | kategori, status aktif/nonaktif, stok menipis |
| Pengguna (`/users`) | nama, email, WhatsApp | toko (Superadmin), role, status |
| Toko (`/stores`) | nama, pemilik | status, jenis usaha, status langganan (nanti) |
| Mutasi stok (`/products/[id]`) | catatan | jenis mutasi, bulan |

### Mengubah data (Server Action)

```
<form action={createSale}>  (Client Component, useActionState)
   └─► features/sales/actions.ts   "use server"
          1. validasi input (zod)         ← JANGAN percaya data dari client
          2. requireStore(permission)     ← autentikasi + otorisasi + storeId
          3. cek kepemilikan / aturan     ← kasir hanya batalkan miliknya, hari sama
          4. service.calculateProfit(...)      ← aturan bisnis
          5. db.transaction: simpan + mutasi stok + nomor dokumen
          6. revalidatePath / redirect
          7. return ActionResult
```

Server Action adalah endpoint publik: siapa pun bisa memanggilnya dengan data
apa pun. Langkah 1–3 **wajib** di setiap action.

### Transaksi database

Semua yang mengubah stok **wajib** dalam satu `db.transaction()`:
simpan dokumen (penjualan/pembelian/opname) → `recordStockMovement()` → update
`products.stock` (dan `cost_price` untuk pembelian). Kalau satu gagal, semua
batal; stok tidak pernah "setengah berubah".

Harga modal rata-rata dihitung di `features/products/service.ts`
(`calculateAverageCost`) sebagai fungsi murni, dipanggil dari action pembelian.

### Kapan pakai `app/api/.../route.ts`?

Hanya untuk unduh file (ekspor Excel), cron, atau webhook. Form di aplikasi
sendiri pakai Server Action.

## 4. Keamanan berlapis

| Lapisan | Tugas |
|---|---|
| `proxy.ts` | Cek cepat "ada cookie session?" → redirect ke /login |
| `lib/auth/dal.ts` | Verifikasi session sungguhan + role (sumber kebenaran) |
| `queries`/`actions` | Selalu panggil DAL, cek permission & kepemilikan |
| `requireStore()` | Multi-tenant: setiap query/action fitur bisnis memakai `storeId` dari DAL di klausa `where`, tidak pernah dari input client |
| DTO | Hanya kirim field yang perlu; `cost_price` tidak pernah ke Kasir |

Dengan `cacheComponents: true`, komponen yang membaca `cookies()` harus
dibungkus `<Suspense>`.

## 5. Uang & jumlah

- Nominal disimpan sebagai **`bigint` dalam rupiah bulat** lewat helper `rupiah()` di `lib/db/schema.ts`. Tipe di kode: `number`.
- Qty disimpan sebagai `integer` (bilangan bulat, lihat BUSINESS-FLOW §3).
- Harga modal rata-rata dibulatkan ke rupiah terdekat (`Math.round`) setiap kali dihitung.
- `SUM()` di PostgreSQL mengembalikan string → petakan dengan `.mapWith(Number)`.
- Laporan **tidak menyimpan** angka agregat; selalu dihitung dari `sale_items`, `expenses`, `stock_take_items`. Satu-satunya angka tersimpan yang "turunan" adalah `products.stock` dan `products.cost_price`, keduanya bisa dihitung ulang dari `stock_movements`.
- Tampilan memakai `formatRupiah()` ("Rp 18.000").

## 6. Referensi

Dokumentasi Next.js versi yang terpasang ada di `node_modules/next/dist/docs/`:

- `01-app/01-getting-started/02-project-structure.md`
- `01-app/02-guides/authentication.md` dan `authentication-with-cache-components.md`
- `01-app/02-guides/data-security.md`
- `01-app/02-guides/forms.md`
- `01-app/01-getting-started/16-proxy.md`
