# Arsitektur SakuSembako

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Cache Components aktif.
Struktur dan pola dev mengikuti ArchiPay; aturan bisnis ada di
[BUSINESS-FLOW.md](./BUSINESS-FLOW.md), rancangan tabel di
[SKEMA-DATABASE.md](./SKEMA-DATABASE.md).

## 1. Struktur folder

```
sakusembako/
├── database/migrations/       # migration SQL hasil drizzle-kit
├── docs/                      # dokumentasi seperti file ini
├── public/                    # file statis (logo, gambar)
├── scripts/                   # buat-superadmin.mjs (akun developer, tersembunyi)
├── src/
│   ├── app/                   # ROUTING SAJA — tipis, tidak ada logika bisnis
│   │   ├── (auth)/layout.tsx               # tampilan tengah tanpa sidebar
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/ganti-password/page.tsx
│   │   ├── (app)/layout.tsx                # sidebar + navbar setelah login
│   │   ├── (app)/page.tsx                  # beranda: dashboard Pemilik / beranda Kasir
│   │   ├── (app)/kasir/page.tsx            # layar penjualan
│   │   ├── (app)/penjualan/page.tsx        # riwayat penjualan
│   │   ├── (app)/penjualan/[id]/page.tsx
│   │   ├── (app)/bon/page.tsx              # piutang per pelanggan
│   │   ├── (app)/pelanggan/page.tsx
│   │   ├── (app)/barang/page.tsx           # master barang & stok
│   │   ├── (app)/barang/baru/page.tsx
│   │   ├── (app)/barang/[id]/page.tsx
│   │   ├── (app)/pembelian/page.tsx        # barang masuk
│   │   ├── (app)/pembelian/baru/page.tsx
│   │   ├── (app)/pembelian/[id]/page.tsx
│   │   ├── (app)/pengeluaran/page.tsx
│   │   ├── (app)/stok-opname/page.tsx
│   │   ├── (app)/stok-opname/[id]/page.tsx
│   │   ├── (app)/laporan/harian/page.tsx
│   │   ├── (app)/laporan/bulanan/page.tsx
│   │   ├── (app)/laporan/tahunan/page.tsx
│   │   ├── (app)/pengguna/page.tsx
│   │   ├── api/laporan/export/route.ts     # unduh Excel
│   │   ├── api/cron/...                    # job terjadwal (bila nanti perlu)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── features/              # LOGIKA PER DOMAIN BISNIS (nama Bahasa Indonesia)
│   │   ├── auth/              # login, logout, ganti password
│   │   ├── pengguna/          # akun Pemilik & Kasir (Superadmin selalu dikecualikan di queries)
│   │   ├── barang/            # master barang, kategori, harga modal rata-rata
│   │   ├── pembelian/         # barang masuk
│   │   ├── penjualan/         # kasir, pembatalan
│   │   ├── bon/               # pelanggan, piutang, pelunasan
│   │   ├── pengeluaran/       # biaya operasional
│   │   ├── stok-opname/
│   │   └── laporan/           # agregasi harian/bulanan/tahunan, dashboard
│   ├── components/            # UI yang dipakai lintas fitur
│   │   ├── ui/                # shadcn/ui (Base UI)
│   │   ├── data-table/        # tabel generik (tanstack)
│   │   ├── theme/             # tema terang/gelap
│   │   └── layout/            # AppSidebar, AppHeader, nav-config.ts (daftar menu)
│   ├── hooks/                 # React hooks bersama (use-mobile)
│   ├── lib/                   # infrastruktur (bukan logika bisnis), nama Inggris
│   │   ├── db/                # koneksi + schema database
│   │   ├── auth/              # password, session, dal, roles, permissions (RBAC)
│   │   ├── stok.ts            # catatMutasiStok(), dipakai pembelian/penjualan/opname
│   │   ├── document-number.ts # nomor BL-/JL- per bulan
│   │   ├── excel.ts           # xlsxResponse() untuk ekspor laporan
│   │   ├── request.ts         # getClientIp()
│   │   ├── env.ts             # validasi environment variable
│   │   ├── dates.ts           # tanggal menurut APP_TIMEZONE
│   │   └── format.ts          # formatRupiah, dll
│   ├── types/                 # tipe global (ActionResult)
│   └── proxy.ts               # (Next 16: pengganti middleware.ts) redirect cepat ke /login
```

### Bahasa penamaan

| Lapisan | Bahasa | Contoh |
|---|---|---|
| Domain: `features/*`, tabel & kolom DB, URL, nav, permission, label UI | **Indonesia** | `features/penjualan`, tabel `penjualan_item`, `/stok-opname`, `barang:lihat-modal` |
| Infrastruktur: `lib/`, `components/ui`, `hooks/`, `types/` | Inggris | `lib/auth/dal.ts`, `ActionResult` |
| Kolom teknis yang sama di semua tabel | Inggris | `id`, `created_at`, `updated_at` |
| Nama fungsi di `features/*` | Indonesia, kata kerja di depan | `catatPenjualan()`, `batalkanPenjualan()`, `hitungHargaModalBaru()` |

Komentar kode dan pesan error untuk user: Bahasa Indonesia.

## 2. Isi satu folder fitur

```
features/penjualan/
├── components/        # form-kasir.tsx, tabel-penjualan.tsx ("use client" bila perlu)
├── constants.ts       # STATUS_PENJUALAN, METODE_BAYAR
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
  `pembelian`, `penjualan`, dan `stok-opname` → `lib/stok.ts`.
- Hindari barrel file (`index.ts` yang re-export semua).

## 3. Alur data

### Membaca data (Server Component)

```
page.tsx (Server Component)
   └─► features/barang/queries.ts    import "server-only"
          ├─ requirePermission("barang:lihat")   ← lib/auth/dal.ts
          ├─ query DB                            ← lib/db
          └─ return DTO                          ← hanya field yang dibutuhkan UI
```

DTO penting di sini karena **Kasir tidak boleh melihat harga modal**: query
untuk layar kasir tidak boleh mengembalikan kolom `harga_modal` sama sekali,
bukan sekadar disembunyikan di UI.

### Mengubah data (Server Action)

```
<form action={catatPenjualan}>  (Client Component, useActionState)
   └─► features/penjualan/actions.ts   "use server"
          1. validasi input (zod)         ← JANGAN percaya data dari client
          2. verifySession + permission   ← autentikasi + otorisasi
          3. cek kepemilikan / aturan     ← kasir hanya batalkan miliknya, hari sama
          4. service.hitungLaba(...)      ← aturan bisnis
          5. db.transaction: simpan + mutasi stok + nomor dokumen
          6. revalidatePath / redirect
          7. return ActionResult
```

Server Action adalah endpoint publik: siapa pun bisa memanggilnya dengan data
apa pun. Langkah 1–3 **wajib** di setiap action.

### Transaksi database

Semua yang mengubah stok **wajib** dalam satu `db.transaction()`:
simpan dokumen (penjualan/pembelian/opname) → `catatMutasiStok()` → update
`barang.stok` (dan `harga_modal` untuk pembelian). Kalau satu gagal, semua
batal; stok tidak pernah "setengah berubah".

Harga modal rata-rata dihitung di `features/barang/service.ts`
(`hitungHargaModalBaru`) sebagai fungsi murni, dipanggil dari action pembelian.

### Kapan pakai `app/api/.../route.ts`?

Hanya untuk unduh file (ekspor Excel), cron, atau webhook. Form di aplikasi
sendiri pakai Server Action.

## 4. Keamanan berlapis

| Lapisan | Tugas |
|---|---|
| `proxy.ts` | Cek cepat "ada cookie session?" → redirect ke /login |
| `lib/auth/dal.ts` | Verifikasi session sungguhan + role (sumber kebenaran) |
| `queries`/`actions` | Selalu panggil DAL, cek permission & kepemilikan |
| DTO | Hanya kirim field yang perlu; `harga_modal` tidak pernah ke Kasir |

Dengan `cacheComponents: true`, komponen yang membaca `cookies()` harus
dibungkus `<Suspense>`.

## 5. Uang & jumlah

- Nominal disimpan sebagai **`bigint` dalam rupiah bulat** lewat helper `rupiah()` di `lib/db/schema.ts`. Tipe di kode: `number`.
- Qty disimpan sebagai `integer` (bilangan bulat, lihat BUSINESS-FLOW §3).
- Harga modal rata-rata dibulatkan ke rupiah terdekat (`Math.round`) setiap kali dihitung.
- `SUM()` di PostgreSQL mengembalikan string → petakan dengan `.mapWith(Number)`.
- Laporan **tidak menyimpan** angka agregat; selalu dihitung dari `penjualan_item`, `pengeluaran`, `stok_opname_item`. Satu-satunya angka tersimpan yang "turunan" adalah `barang.stok` dan `barang.harga_modal`, keduanya bisa dihitung ulang dari `mutasi_stok`.
- Tampilan memakai `formatRupiah()` ("Rp 18.000").

## 6. Referensi

Dokumentasi Next.js versi yang terpasang ada di `node_modules/next/dist/docs/`:

- `01-app/01-getting-started/02-project-structure.md`
- `01-app/02-guides/authentication.md` dan `authentication-with-cache-components.md`
- `01-app/02-guides/data-security.md`
- `01-app/02-guides/forms.md`
- `01-app/01-getting-started/16-proxy.md`
