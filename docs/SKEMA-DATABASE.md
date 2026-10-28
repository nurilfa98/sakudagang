# Rancangan Skema Database SakuSembako

Rancangan tabel untuk v1, turunan dari [BUSINESS-FLOW.md](./BUSINESS-FLOW.md).
Setelah diimplementasi, sumber kebenaran adalah `src/lib/db/schema.ts`; dokumen
ini menjadi penjelasan "kenapa"-nya.

Konvensi (lihat [ARCHITECTURE.md](./ARCHITECTURE.md) §1 & §5):

- Nama tabel & kolom Bahasa Indonesia, `snake_case`, tabel berbentuk tunggal (`barang`, bukan `barangs`).
- `id` = `varchar(36)` UUID dibuat aplikasi. Semua waktu `timestamptz`. Uang `bigint` rupiah bulat. Qty `integer`.
- Kolom `created_at` di semua tabel; `updated_at` hanya di tabel yang bisa diedit.
- Kolom pelaku: `dibuat_oleh_id` → `pengguna.id`.
- Status/enum disimpan `varchar` dengan daftar nilai di `features/*/constants.ts` (bukan enum PostgreSQL, agar menambah nilai tidak butuh migration).

Status: **draf, belum ada migration.**

---

## Peta tabel

```
pengguna ──┐
peran ─────┴── pengguna_peran
login_attempts

kategori_barang ──< barang >──< mutasi_stok
                      │
      pembelian >──< pembelian_item
      penjualan >──< penjualan_item
      pelanggan >──< penjualan (BON) >──< pelunasan_bon
      stok_opname >──< stok_opname_item
      kategori_pengeluaran ──< pengeluaran
      nomor_dokumen
```

---

## 1. Akun

### `pengguna`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | varchar(36) PK | |
| nama | varchar(100) | |
| email | varchar(100) unique | Untuk login. |
| password_hash | varchar(255) | bcrypt. |
| aktif | boolean default true | Nonaktif = tidak bisa login. |
| wajib_ganti_password | boolean default true | Password sementara dari Pemilik. |
| session_version | integer default 1 | Dinaikkan saat ganti/reset password → semua perangkat logout. |
| created_at, updated_at | timestamptz | |

### `peran`, `pengguna_peran`

`peran`: `id`, `nama` unique (`SUPERADMIN`, `PEMILIK`, `KASIR`), `created_at`. Diisi migration.
`pengguna_peran`: `pengguna_id`, `peran_id` (PK gabungan). Satu user satu peran; Pemilik tidak perlu peran KASIR karena haknya sudah mencakup.

Akun SUPERADMIN **tidak punya kolom khusus** di `pengguna`; "tersembunyi"
diterapkan di query (`features/pengguna/queries.ts` selalu mengecualikan
pengguna yang punya peran SUPERADMIN) dan di action (menolak target
SUPERADMIN). Dengan begitu tidak ada jalur lain untuk mengubahnya selain script.

### `login_attempts`

`id`, `email`, `ip_address varchar(45)`, `success boolean`, `created_at`. Untuk rate limit login (nama Inggris: infrastruktur, sama dengan ArchiPay). Index `(email, created_at)`, `(ip_address, created_at)`.

---

## 2. Barang & stok

### `kategori_barang`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| nama | varchar(50) unique | Sembako, Minuman, Rokok, … Diisi awal lewat migration. |
| urutan | smallint | Urutan tampil. |
| created_at | | |

### `barang`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| nama | varchar(100) unique | "Minyak Goreng 1 L". |
| kategori_id | FK → kategori_barang | |
| satuan | varchar(20) | Label: pcs, kg, bungkus. |
| harga_modal | bigint | Rata-rata tertimbang. **Turunan** dari mutasi_stok; diubah hanya oleh pembelian / stok awal / pembatalan pembelian. |
| harga_jual | bigint | Diatur pemilik. |
| stok | integer default 0 | **Turunan** dari Σ mutasi_stok.qty. Boleh negatif. |
| stok_minimum | integer null | Untuk daftar "perlu restock". |
| aktif | boolean default true | |
| created_at, updated_at | | |

Index: `(aktif, nama)` untuk pencarian kasir; `kategori_id`.

### `mutasi_stok` (ledger)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| barang_id | FK → barang | |
| jenis | varchar(20) | `STOK_AWAL`, `PEMBELIAN`, `PEMBELIAN_BATAL`, `PENJUALAN`, `PENJUALAN_BATAL`, `OPNAME`. |
| qty | integer | Bertanda: + masuk, − keluar. |
| stok_sesudah | integer | Snapshot `barang.stok` setelah baris ini; mempermudah audit. |
| harga_modal | bigint | Harga modal barang saat mutasi dibuat (setelah dihitung ulang, bila pembelian). |
| referensi_tabel | varchar(30) | `pembelian`, `penjualan`, `stok_opname`, atau null untuk STOK_AWAL. |
| referensi_id | varchar(36) null | Id dokumen pemicu. |
| dibuat_oleh_id | FK → pengguna | |
| created_at | | |

Index: `(barang_id, created_at)`; `(referensi_tabel, referensi_id)`.

Aturan: tidak pernah di-update atau dihapus. Koreksi = baris baru.

---

## 3. Pembelian (barang masuk)

### `pembelian`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| nomor | varchar(20) unique | `BL-2026-10-0001`. |
| periode_tahun, periode_bulan | smallint | Untuk filter & nomor. |
| tanggal | date | Tanggal belanja (bisa beda dari created_at bila dicatat belakangan). |
| catatan | varchar(500) null | "Belanja di grosir Pak Haji". |
| total | bigint | Σ item.subtotal. Snapshot. |
| status | varchar(20) | `SELESAI`, `DIBATALKAN`. |
| alasan_batal | varchar(500) null | |
| dibatalkan_oleh_id, dibatalkan_at | FK, timestamptz null | |
| dibuat_oleh_id | FK → pengguna | |
| created_at | | |

### `pembelian_item`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| pembelian_id | FK → pembelian | |
| barang_id | FK → barang | |
| nama_barang | varchar(100) | Snapshot. |
| qty | integer > 0 | |
| harga_beli | bigint | Per satuan. |
| subtotal | bigint | harga_beli × qty. |
| harga_modal_sebelum | bigint | Jejak perhitungan rata-rata. |
| harga_modal_sesudah | bigint | |
| harga_jual_baru | bigint null | Bila pemilik mengubah harga jual saat restock. |

Unique `(pembelian_id, barang_id)`: satu barang satu baris per pembelian.

---

## 4. Penjualan (kasir)

### `pelanggan`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| nama | varchar(100) | Tidak unique (bisa ada dua "Bu Sri"); UI memperingatkan nama sama. |
| telepon | varchar(20) null | Format 62…, lihat `lib/phone.ts` ArchiPay bila diperlukan. |
| catatan | varchar(500) null | "Rumah sebelah masjid". |
| boleh_bon | boolean default true | |
| created_at, updated_at | | |

### `penjualan`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| nomor | varchar(20) unique | `JL-2026-10-0001`. |
| periode_tahun, periode_bulan | smallint | |
| tanggal | date | Tanggal kalender menurut APP_TIMEZONE; kunci laporan harian & aturan "hari yang sama". |
| metode_bayar | varchar(10) | `TUNAI`, `QRIS`, `BON`. |
| pelanggan_id | FK null | Wajib bila BON. CHECK: `metode_bayar <> 'BON' OR pelanggan_id IS NOT NULL`. |
| total | bigint | Σ item.subtotal. |
| total_modal | bigint | Σ item.harga_modal × qty = HPP transaksi. |
| total_laba_kotor | bigint | total − total_modal. |
| uang_diterima | bigint null | Hanya TUNAI; kembalian = uang_diterima − total. |
| status_bayar | varchar(15) | `LUNAS` (TUNAI/QRIS langsung), `BELUM_LUNAS` (BON). |
| status | varchar(15) | `SELESAI`, `DIBATALKAN`. |
| alasan_batal, dibatalkan_oleh_id, dibatalkan_at | | |
| dibuat_oleh_id | FK → pengguna | Kasir yang mencatat; dasar aturan "batalkan miliknya sendiri". |
| created_at | | |

Index: `(tanggal, status)`; `(pelanggan_id, status_bayar)`; `dibuat_oleh_id`.

### `penjualan_item`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| penjualan_id | FK | |
| barang_id | FK | |
| nama_barang | varchar(100) | Snapshot. |
| qty | integer > 0 | |
| harga_jual | bigint | Snapshot, boleh diubah kasir per transaksi. |
| harga_modal | bigint | Snapshot. **Tidak pernah dikirim ke Kasir.** |
| subtotal | bigint | harga_jual × qty. |
| laba_kotor | bigint | (harga_jual − harga_modal) × qty. |

Index `(barang_id)` untuk "barang terlaris". Unique `(penjualan_id, barang_id)`.

### `pelunasan_bon`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| penjualan_id | FK → penjualan (metode BON) | Satu pelunasan → satu bon. |
| tanggal | date | Tanggal uang diterima (dasar "uang masuk"). |
| nominal | bigint > 0 | Boleh sebagian. Σ pelunasan ≤ penjualan.total (dicek di action). |
| metode_bayar | varchar(10) | `TUNAI`, `QRIS`. |
| dibuat_oleh_id | FK | |
| created_at | | |

Sisa bon = `penjualan.total − Σ pelunasan_bon.nominal`; bila 0 → `status_bayar = LUNAS`. Sisa tidak disimpan, dihitung.

---

## 5. Pengeluaran operasional

### `kategori_pengeluaran`

`id`, `nama` unique, `urutan`, `created_at`. Diisi migration: Listrik & air, Transport, Kemasan/plastik, Gaji, Sewa, Lainnya.

### `pengeluaran`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| tanggal | date | |
| kategori_id | FK | |
| nominal | bigint > 0 | |
| keterangan | varchar(500) null | |
| dibuat_oleh_id | FK | |
| created_at, updated_at | | Boleh diedit/dihapus (hard delete) oleh Pemilik. |

Index `(tanggal)`.

---

## 6. Stok opname

### `stok_opname`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| nomor | varchar(20) unique | `SO-2026-10-0001`. |
| tanggal | date | Tanggal opname (diisi saat selesai; saat draf = tanggal dibuat). |
| status | varchar(10) | `DRAF`, `SELESAI`. Hanya satu DRAF (unique partial index `WHERE status = 'DRAF'`). |
| catatan | varchar(500) null | |
| total_penyusutan | bigint null | Σ |selisih kurang| × harga_modal, diisi saat SELESAI. Snapshot untuk laporan. |
| diselesaikan_oleh_id, diselesaikan_at | | |
| dibuat_oleh_id, created_at | | |

### `stok_opname_item`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | PK | |
| stok_opname_id | FK | |
| barang_id | FK | |
| nama_barang | varchar(100) | Snapshot. |
| stok_sistem | integer | Diisi saat draf dibuat; **ditimpa ulang** saat SELESAI dengan `barang.stok` terkini. |
| stok_fisik | integer null | null = belum dihitung → tidak diproses saat SELESAI. |
| selisih | integer null | stok_fisik − stok_sistem (final saat SELESAI). |
| alasan | varchar(20) null | `RUSAK`, `KEDALUWARSA`, `HILANG`, `DIPAKAI_SENDIRI`, `SALAH_CATAT`, `LAINNYA`. Wajib bila selisih ≠ 0. |
| keterangan | varchar(255) null | |
| harga_modal | bigint null | Snapshot saat SELESAI, dasar penyusutan. |
| nilai_penyusutan | bigint null | |selisih| × harga_modal bila selisih < 0, selain itu 0. |

Unique `(stok_opname_id, barang_id)`.

---

## 7. Penomoran

### `nomor_dokumen`

| Kolom | Tipe | Keterangan |
|---|---|---|
| prefix | varchar(5) | `BL`, `JL`, `SO`. |
| periode_tahun, periode_bulan | smallint | |
| nilai_terakhir | integer | |

PK gabungan `(prefix, periode_tahun, periode_bulan)`. Diambil dengan `INSERT … ON CONFLICT DO UPDATE … RETURNING` di dalam transaksi yang sama dengan dokumennya (pola `lib/document-number.ts` ArchiPay), sehingga dua kasir yang menyimpan bersamaan tidak dapat nomor kembar.

---

## 8. Query laporan (bukan tabel)

Semua angka laporan dihitung saat diminta dari tabel di atas, difilter
`status = 'SELESAI'`. Ringkasan sumber tiap angka:

| Angka | Sumber |
|---|---|
| Omset, HPP, laba kotor | `penjualan` (SUM total, total_modal, total_laba_kotor) per `tanggal` |
| Pengeluaran | `pengeluaran` per `tanggal` |
| Penyusutan | `stok_opname.total_penyusutan` per `tanggal` (status SELESAI) |
| Uang masuk tunai/QRIS | `penjualan` metode TUNAI/QRIS + `pelunasan_bon` per `tanggal` |
| Uang keluar | `pembelian.total` + `pengeluaran.nominal` |
| Bon baru | `penjualan` metode BON per `tanggal` |
| Piutang berjalan | `penjualan` BON BELUM_LUNAS: total − Σ pelunasan |
| Barang terlaris, laba per kategori | `penjualan_item` join `barang`, `kategori_barang` |
| Perlu restock | `barang` where `stok <= stok_minimum` or `stok < 0` |

Bila nanti laporan tahunan terasa lambat (ratusan ribu baris), tambahkan
index `(tanggal)` di `penjualan` sudah cukup untuk warung; agregat harian
tersimpan (materialized) adalah opsi v2.

---

## 9. Data awal (migration pertama)

- `peran`: SUPERADMIN, PEMILIK, KASIR.
- `kategori_barang`: Sembako, Minuman, Makanan ringan, Rokok, Kebutuhan rumah, Lainnya.
- `kategori_pengeluaran`: Listrik & air, Transport, Kemasan/plastik, Gaji, Sewa, Lainnya.
- Akun Superadmin: lewat `pnpm db:buat-superadmin <email> <password> "<Nama>"`, bukan migration. Akun Pemilik dibuat Superadmin dari halaman Pengguna.

---

## 10. Catatan desain

- **Kenapa `total_modal` disimpan di `penjualan`** padahal bisa dijumlah dari item? Supaya laporan harian/bulanan cukup SUM satu tabel tanpa join item. Nilainya snapshot dan tidak pernah berubah setelah disimpan, jadi aman.
- **Kenapa `barang.stok` disimpan** padahal turunan ledger? Layar kasir membaca stok puluhan barang sekaligus; SUM ledger tiap kali tidak perlu. Konsistensi dijaga karena keduanya ditulis dalam transaksi yang sama. Sediakan script `pnpm db:hitung-ulang-stok` untuk memverifikasi/memperbaiki.
- **Kenapa pembatalan bukan hapus?** Riwayat & nomor dokumen harus tetap utuh untuk audit pemilik.
- **Kenapa status bukan enum PostgreSQL?** Menambah nilai status jadi perubahan kode saja, bukan migration `ALTER TYPE`.
