# Alur Bisnis SakuDagang

Acuan untuk memahami cara kerja SakuDagang: pencatatan **kasir**, **stok
barang**, dan **laporan keuangan** untuk toko ritel kecil yang punya stok
(warung sembako, toko kelontong, toko bangunan, toko pertanian, dll). Tujuan
aplikasi: pemilik toko tahu omset harian, laba rugi, dan bisa memisahkan
**uang modal** (yang harus diputar lagi untuk belanja stok) dari **uang laba**
(yang boleh diambil). Klien pertama adalah warung sembako, jadi contoh di
dokumen ini memakai konteks warung.

Dokumen ini menjelaskan aturan bisnis; struktur kode ada di
[ARCHITECTURE.md](./ARCHITECTURE.md).

**Multi-tenant (SaaS).** Satu deployment melayani banyak **toko**. Setiap
Pemilik dan Kasir terikat pada tepat satu toko, dan hanya melihat data toko
itu. Superadmin (pengelola SakuDagang) membuat toko beserta akun Pemiliknya.
Lintas toko tidak ada: pemilik dua toko memakai dua akun (multi-cabang = v2).

Status: **v1 disepakati 28 Oktober 2026; seluruh alur §3–§10 diimplementasi
29–30 Oktober 2026.** Sumber kebenaran tiap aturan ada di tabel berikut; bila
kode dan dokumen berbeda, perbaiki salah satunya.

| Aturan | File |
|---|---|
| Hak akses per peran | `src/lib/auth/permissions.ts` |
| Masa gratis, tenggang, kunci akses toko (§14) | `src/lib/subscription-access.ts`, `src/lib/auth/dal.ts` |
| Harga paket, perpanjangan periode (§14) | `src/features/subscriptions/service.ts`, `src/features/subscriptions/actions.ts` |
| Rumus harga modal rata-rata, laba | `src/features/products/service.ts`, `src/features/sales/service.ts` |
| Pembelian, pembatalan & hitung ulang harga modal (§4, §8) | `src/features/purchases/actions.ts`, `src/features/products/service.ts` (`replayAverageCost`) |
| Nomor dokumen BL-/JL-/SO- | `src/lib/document-number.ts` |
| Penjualan: harga per transaksi, siapa boleh membatalkan (§5) | `src/features/sales/service.ts`, `src/features/sales/actions.ts` |
| Pelunasan bon, sisa piutang (§6) | `src/features/credits/service.ts`, `src/features/credits/actions.ts` |
| Pengeluaran & kategorinya (§7) | `src/features/expenses/actions.ts` |
| Stok opname: selisih, alasan wajib, penyusutan (§9) | `src/features/stock-takes/service.ts`, `src/features/stock-takes/actions.ts` |
| Daftar & arti status | `src/features/*/constants.ts` |
| Rumus laporan & dashboard (§10) | `src/features/reports/service.ts`, `src/features/reports/queries.ts` |

---

## 1. Istilah

| Istilah | Arti |
|---|---|
| **Barang** | Satu jenis produk yang dijual, dengan **satu satuan** (pcs, kg, bungkus, dst). Produk yang sama dengan kemasan berbeda adalah barang berbeda (mis. "Gula 1 kg" dan "Gula ½ kg"). |
| **Harga modal** | Harga pokok per satuan, dihitung **rata-rata tertimbang** dari semua pembelian (lihat §4). Berubah setiap ada pembelian. |
| **Harga jual** | Harga per satuan yang dibayar pembeli. Diatur pemilik di master barang. |
| **Pembelian** | Satu kali belanja stok (barang masuk), bisa berisi banyak barang. Nomor: `BL-2026-10-0001`. |
| **Penjualan** | Satu transaksi kasir (barang keluar), bisa berisi banyak barang. Nomor: `JL-2026-10-0001`. |
| **HPP** (harga pokok penjualan) | Modal dari barang yang terjual = Σ harga modal × qty. Inilah **uang modal yang harus diputar lagi**. |
| **Laba kotor** | Omset − HPP. |
| **Pengeluaran** | Biaya operasional di luar belanja stok: listrik, plastik, bensin, gaji kasir, dll. |
| **Laba bersih** | Laba kotor − pengeluaran − penyusutan. Inilah **uang laba**. |
| **Bon** | Penjualan yang belum dibayar (kasbon pelanggan). Tercatat sebagai **piutang** sampai dilunasi. |
| **Mutasi stok** | Buku besar stok per barang: setiap pergerakan stok adalah satu baris (+ masuk, − keluar). |
| **Stok opname** | Pencocokan stok fisik dengan stok sistem di akhir bulan. |
| **Penyusutan** | Nilai barang yang hilang/rusak, ditemukan saat opname = Σ selisih kurang × harga modal. |

---

## 2. Peran & hak akses

Tiga peran: **Superadmin**, **Pemilik**, dan **Kasir**.

- **Superadmin** = pengelola platform SakuDagang (developer), bukan orang
  toko dan **tidak terikat toko mana pun**. Dibuat lewat script saat deployment
  (`pnpm db:create-superadmin`), **tidak muncul di daftar pengguna**, dan tidak
  bisa diubah/dinonaktifkan oleh Pemilik. Tugasnya: membuat **toko** baru,
  membuat akun Pemilik untuk toko itu, menonaktifkan toko yang berhenti
  berlangganan, dan membantu bila ada masalah teknis.
- **Pemilik** memiliki **semua** hak Kasir, jadi pemilik yang menjaga warung
  sendiri cukup punya satu akun Pemilik. Saat merekrut karyawan, pemilik
  membuat akun Kasir; pekerjaan kasir berpindah tanpa mengubah apa pun di
  aplikasi. Pemilik **tidak bisa** membuat Pemilik lain; itu wewenang Superadmin.

| Kemampuan | Superadmin | Pemilik | Kasir |
|---|:---:|:---:|:---:|
| Kasir: mencatat penjualan (tunai, QRIS, bon) | ✓ | ✓ | ✓ |
| Membatalkan penjualan | ✓ semua | ✓ semua | ✓ hanya miliknya, hari yang sama |
| Mencatat pelunasan bon | ✓ | ✓ | ✓ |
| Melihat daftar barang, harga jual, dan stok | ✓ | ✓ | ✓ |
| Melihat **harga modal** dan laba | ✓ | ✓ | |
| Master barang: tambah/ubah barang, kategori, harga | ✓ | ✓ | |
| Pembelian (barang masuk) | ✓ | ✓ | |
| Pengeluaran operasional | ✓ | ✓ | |
| Stok opname | ✓ | ✓ | |
| Laporan & dashboard | ✓ | ✓ | |
| Pelanggan (data bon) | ✓ | ✓ | ✓ tambah & lihat |
| Ubah pelanggan, tandai "tidak boleh bon" | ✓ | ✓ | |
| Membatalkan pelunasan bon | ✓ semua | ✓ semua | ✓ hanya catatannya, hari yang sama |
| Pengguna: buat/nonaktifkan **Kasir**, reset password | ✓ | ✓ | |
| Pengguna: buat/nonaktifkan **Pemilik**, reset password | ✓ | | |
| **Profile**: ubah nama, email, WhatsApp diri sendiri (menu user di header) | ✓ | ✓ | ✓ |
| Melihat data Pemilik lain di toko yang sama (tanpa mengubah) | ✓ | ✓ | |
| Toko: buat, ubah data, nonaktifkan (langganan berhenti) | ✓ | ubah data toko sendiri | |
| Melihat & mengelola akun Superadmin | script saja | | |

### 2.1 Hierarki: Superadmin → Toko → Pemilik → Kasir

SakuDagang dijual sebagai SaaS. **Klien** SakuDagang adalah **toko**; Superadmin
adalah pengelola klien, bukan bagian dari toko mana pun.

```
Superadmin (platform SakuDagang)
└── Toko A (klien, langganan)
    ├── Pemilik  — mengelola toko, membuat Kasir
    │   └── Kasir — mencatat penjualan
    └── Pemilik lain (bila ada; dibuat Superadmin)
└── Toko B …
```

Aturan turunan dari hierarki ini:

| Lapisan | Siapa | Apa yang dilihat & dikelola |
|---|---|---|
| Platform | Superadmin | Semua toko, semua Pemilik/Kasir, status langganan (v2). |
| Toko | Pemilik | Hanya data tokonya: barang, transaksi, laporan, Kasir. |
| Toko | Kasir | Hanya layar kasir & barang tokonya, tanpa harga modal. |

**Navigasi** (31 Okt 2026, pola sama dengan ArchiPay, tanpa sidebar):

- **Pemilik & Kasir**: setelah login membuka **kotak menu** di `/`: ikon menu
  + kolom cari (Enter membuka menu pertama yang cocok), difilter sesuai
  permission. Dashboard ada di menu **Beranda** (`/beranda`).
- Header berisi logo (kembali ke kotak menu), breadcrumb "Menu > nama menu",
  toko & masa aktif, tema, dan menu user. Tombol bulat di kanan bawah juga
  kembali ke kotak menu (disembunyikan di layar Kasir agar tidak menutupi
  tombol bayar).
- **Toko terkunci**: menu tetap tampil dengan ikon gembok; selain Langganan
  mengarah ke halaman Langganan dengan pesan menu asalnya.

**Superadmin** (tidak punya Beranda):

1. Setelah login langsung ke halaman **Toko** (`/stores`). Halaman platform
   berpindah lewat tab **Toko · Tagihan · Pengaturan platform**; di halaman
   ini breadcrumb tanpa "Menu" dan tanpa tombol bulat.
2. Halaman Toko berupa **kartu per toko**: nama, pemilik (peringatan bila
   belum ada), jumlah pengguna & barang, jenis usaha, tanggal bergabung, masa
   aktif ("Gratis s.d. … · 12 hari lagi"), status, dan tombol **Buka**. Klik
   kartu = detail toko. Ada pencarian (nama, pemilik, jenis usaha), chip saring
   status beserta jumlahnya, dan pita "N tagihan menunggu konfirmasi" ke
   Tagihan. Kartu diurutkan dari yang perlu tindakan: Habis, Tenggang, Segera
   habis (≤ 7 hari), lainnya, Nonaktif.
3. **Warna & ikon kartu = status** (`src/features/stores/status.ts`):
   **Masa gratis** indigo (hadiah), **Aktif** hijau (centang), **Tenggang**
   kuning (jam pasir), **Habis** merah (gembok), **Nonaktif** abu-abu (tombol
   daya). Chip saring memakai titik warna yang sama sebagai keterangan.
4. **Buka** membuat toko itu menjadi **toko aktif** (cookie) lalu membuka kotak
   menu berisi menu toko itu saja (Kasir, Penjualan, …, Pengguna). Pita
   "Melihat toko … [Ganti] [Keluar]" tampil di bawah header; Ganti & Keluar
   kembali ke halaman Toko. Selama toko aktif dipilih, semua menu bekerja
   persis seperti untuk Pemilik toko itu, termasuk mencatat transaksi
   (tercatat atas nama Superadmin). Tanpa toko aktif, halaman toko
   mengarahkan ke halaman Toko (`requireStore()`).
5. **Pengguna** dikelola dari dalam toko: buka toko → menu Pengguna (tambah
   Pemilik/Kasir, reset password, nonaktifkan). Tidak ada lagi daftar pengguna
   lintas toko. Detail toko hanya menampilkan daftar penggunanya; toko tanpa
   pemilik punya tombol **Buka toko & tambah pemilik**.
6. **Detail toko** (Superadmin): status & tombol Buka, pengguna (lihat saja),
   **Langganan** (masa aktif, tagihan toko itu di menu Tagihan, harga khusus,
   catat pembayaran langsung), data toko, dan saklar status toko.

Pemilik/Kasir tidak punya pilihan toko: toko aktifnya selalu tokonya sendiri.

Rencana v2: **langganan per toko** (periode 1 / 3 / 12 bulan, diskon),
dikelola Superadmin dari halaman toko; lihat §14. Di v1 status toko
aktif/nonaktif diatur Superadmin secara manual dan berfungsi sebagai
"langganan berjalan/berhenti".

Alasan Kasir tidak melihat harga modal: margin warung adalah informasi pemilik.
Layar kasir hanya menampilkan harga jual.

Permission (format `<sumber-daya>:<aksi>`), rencana:

```
sale:create          sale:void-own             sale:void-all
credit:settle        customer:manage           customer:edit
product:view         product:manage            product:view-cost
purchase:manage      expense:manage            stock-take:manage
report:view          user:manage-cashier       user:manage-owner
store:manage         store:edit-own
```

Kasir (`CASHIER`): `sale:create`, `sale:void-own`, `credit:settle`,
`customer:manage`, `product:view`.
Pemilik (`OWNER`): semuanya kecuali `user:manage-owner` dan `store:manage`.
Superadmin: semuanya, tetapi tanpa toko sehingga permission transaksi tidak terpakai.

**Aturan tenant (berlaku di semua query & action):** data selalu difilter
`store_id = toko user yang login`. Pengecekan ini ada di lapisan data
(`requireStore()` di `lib/auth/dal.ts`), bukan hanya di UI, sehingga user
yang menebak id dokumen toko lain tetap mendapat "tidak ditemukan".
Superadmin: semuanya.

Aturan tersembunyi untuk Superadmin (diterapkan di query & action, bukan
hanya UI):

- Daftar pengguna tidak pernah menampilkan akun berperan SUPERADMIN, untuk siapa pun.
- Action ubah/nonaktifkan/reset password menolak target berperan SUPERADMIN.
- Akun Superadmin hanya dibuat, diubah, dan dinonaktifkan lewat script.

---

## 3. Master barang

Data per barang:

| Kolom | Keterangan |
|---|---|
| name | Unik. Contoh: "Minyak Goreng 1 L", "Gula ½ kg". |
| category | Dari daftar kategori (Sembako, Minuman, Rokok, Kebutuhan rumah, dst). Pemilik bisa menambah. |
| unit | Teks bebas pendek: pcs, kg, bungkus, botol, sachet. Hanya label; **qty selalu bilangan bulat**. |
| cost_price | Harga modal rata-rata tertimbang, **dihitung otomatis** dari pembelian. Boleh diisi manual hanya saat barang pertama dibuat (stok awal). |
| selling_price | Harga jual, diatur pemilik. Bisa diubah kapan saja; penjualan lama tidak berubah karena menyimpan snapshot. |
| stock | Jumlah saat ini. Diubah hanya lewat mutasi stok (§8), tidak pernah diedit langsung. |
| min_stock | Opsional. Bila stok ≤ ini, barang masuk daftar "Perlu restock". |
| is_active | Barang nonaktif tidak muncul di kasir, tetapi riwayatnya tetap ada. Barang **tidak pernah dihapus** bila sudah pernah dipakai di transaksi. |

**Stok awal.** Saat membuat barang baru yang sudah punya stok fisik, pemilik
mengisi stok awal + harga modal awal. Ini dicatat sebagai mutasi stok jenis
`INITIAL`, sehingga nilainya ikut masuk perhitungan rata-rata berikutnya.

---

## 4. Pembelian (barang masuk)

Status: **diimplementasi 30 Oktober 2026** (menu Transaksi → Pembelian).

Pemilik mencatat satu kali belanja: tanggal, catatan (mis. "Belanja di
grosir Pak Haji"), dan daftar barang dengan **qty** dan **harga beli per
satuan**. Total pembelian = Σ harga beli × qty = **modal keluar** pada tanggal
itu.

Saat disimpan, untuk setiap barang (dalam satu transaksi database):

1. Harga modal baru dihitung rata-rata tertimbang, dibulatkan ke rupiah:

   ```
   new_cost_price = (old_stock × old_cost_price + purchase_qty × unit_cost)
                    ÷ (old_stock + purchase_qty)
   ```

   Contoh: stok 10 @ Rp17.000, beli 20 @ Rp18.500 →
   (170.000 + 370.000) ÷ 30 = **Rp18.000**.

   Bila stok lama ≤ 0 (habis atau minus), harga modal baru = harga beli
   (rata-rata dengan stok minus tidak masuk akal).

2. Mutasi stok `PURCHASE` +qty, stok barang bertambah.
3. Opsional: pemilik bisa langsung mengisi **harga jual baru** di baris
   pembelian (harga grosir naik → harga jual ikut naik). Kosong = tidak berubah.

Baris pembelian menyimpan `unit_cost` dan `cost_price_before/after`
sebagai jejak.

**Mengubah/membatalkan pembelian.** Pembelian yang sudah tersimpan **tidak bisa
diedit**; bila salah, pemilik membatalkannya (status `VOIDED`). Pembatalan
membuat mutasi stok `PURCHASE_VOID` −qty dan **menghitung ulang harga
modal** dari riwayat (lihat §8). Pembatalan ditolak bila stok salah satu
barang saat ini lebih kecil dari qty pembelian itu (stok akan minus, artinya
barangnya sudah terjual)—pesan: "<Barang> dari pembelian ini sudah terjual,
buat penyesuaian lewat stok opname." Harga jual yang sempat diubah lewat
pembelian **tidak** dikembalikan saat dibatalkan; ubah manual bila perlu.

Biaya belanja di luar harga barang (bensin, parkir, ongkos angkut) **bukan**
bagian pembelian; dicatat di Pengeluaran (§7).

---

## 5. Kasir (penjualan)

Status: **diimplementasi 30 Oktober 2026** (menu Transaksi → Kasir & Penjualan;
pelanggan bisa ditambah dari layar kasir). Riwayat penjualan menampilkan satu hari (bawaan
hari ini); Kasir hanya melihat transaksinya sendiri, Pemilik semua beserta laba.

Layar utama Kasir, dioptimalkan untuk HP: cari barang (nama), tambah ke
keranjang, ubah qty, pilih metode bayar, simpan. Satu transaksi = satu
penjualan dengan nomor `JL-YYYY-MM-NNNN`.

### 5.1 Baris penjualan

Setiap baris menyimpan **snapshot** saat transaksi, bukan referensi ke master:

| Kolom | Isi |
|---|---|
| product_id, product_name | Nama ikut disalin agar laporan tetap terbaca bila barang diganti nama. |
| qty | Bilangan bulat ≥ 1. |
| selling_price | Harga jual master saat itu. Kasir **boleh mengubah** untuk satu transaksi (diskon/pembulatan), tetapi tidak boleh di bawah harga modal—pemilik bisa, kasir tidak. |
| cost_price | Harga modal master saat itu. Tidak tampil untuk Kasir. |
| subtotal | selling_price × qty. |
| gross_profit | (selling_price − cost_price) × qty. |

Total penjualan = Σ subtotal. Laba kotor penjualan = Σ gross_profit.

### 5.2 Metode bayar

| Metode | Akibat |
|---|---|
| `CASH` | Uang masuk kas hari itu. Kasir mengisi "uang diterima", aplikasi menghitung kembalian. |
| `QRIS` | Uang masuk (non-tunai) hari itu. |
| `CREDIT` (bon) | Wajib pilih **pelanggan**. Penjualan berstatus bayar `UNPAID`, menjadi piutang (§6). |

Satu penjualan hanya satu metode. Bayar sebagian tunai + sisanya bon tidak
didukung di v1 (buat dua transaksi).

### 5.3 Stok saat menjual

- Stok dipotong **saat transaksi disimpan** (mutasi `SALE` −qty), bukan saat barang masuk keranjang.
- **Stok minus diperbolehkan.** Warung sering punya barang fisik yang belum tercatat. Kasir melihat peringatan "Stok sistem: 0" tetapi tetap bisa menyimpan. Stok minus muncul merah di daftar barang dan diluruskan saat opname (§9) atau pembelian.
- Barang nonaktif tidak bisa dijual.

### 5.4 Pembatalan (void)

Penjualan yang sudah tersimpan **tidak bisa diedit**; salah input = batalkan,
lalu buat yang baru.

- Kasir: hanya penjualan **miliknya sendiri** pada **hari yang sama** (tanggal menurut `APP_TIMEZONE`).
- Pemilik: penjualan apa pun, kapan pun.
- Wajib mengisi alasan.
- Akibat: status `VOIDED`, mutasi stok `SALE_VOID` +qty per baris, omset/laba hari itu berkurang. Bon yang sudah ada pelunasannya **tidak bisa** dibatalkan (batalkan pelunasannya dulu).
- Penjualan yang dibatalkan tetap tampil di riwayat (dicoret), tidak dihapus.

---

## 6. Bon (piutang pelanggan)

Status: **diimplementasi 30 Oktober 2026** (menu Transaksi → Bon; pelunasan
juga bisa dari detail penjualan). Pelunasan yang salah dicatat **dibatalkan**
(status `VOIDED` + alasan), tidak dihapus: Pemilik kapan pun, Kasir hanya
pelunasan yang ia catat sendiri pada hari yang sama. Halaman pelanggan punya
tombol "Tagih via WhatsApp" (click-to-chat dari HP pengguna, berisi sisa bon).

| Hal | Aturan |
|---|---|
| Pelanggan | Nama (wajib), nomor HP (opsional), catatan. Kasir boleh menambah pelanggan baru dari layar kasir. |
| Omset | Penjualan bon **tetap dihitung omset dan laba** pada tanggal penjualan (uang belum masuk, tapi barang sudah keluar). Laporan memisahkan "omset" dan "uang masuk". |
| Pelunasan | Bisa sebagian atau penuh, metode `CASH`/`QRIS`, tanggal pelunasan. Satu pelunasan dialokasikan ke **satu** penjualan bon (pilih bon mana yang dibayar). Setelah total pelunasan = total penjualan → status bayar `PAID`. |
| Uang masuk | Pelunasan dihitung sebagai uang masuk pada tanggal pelunasan, **bukan** omset (omset sudah dihitung saat jual). |
| Daftar piutang | Per pelanggan: total bon, total dibayar, sisa. Pemilik dan Kasir melihat daftar ini. |
| Batas bon | Tidak ada pembatasan otomatis di v1. Pemilik bisa menandai pelanggan "tidak boleh bon" (flag `allow_credit = false`). |

---

## 7. Pengeluaran operasional

Status: **diimplementasi 30 Oktober 2026** (menu Transaksi → Pengeluaran; kategori
di `/expenses/categories`, kategori awal diisi saat toko dibuat dan oleh
migration untuk toko lama).

Pemilik mencatat: tanggal, kategori, nominal, keterangan. Kategori awal diisi
migration: **Listrik & air, Transport, Kemasan/plastik, Gaji, Sewa, Lainnya**;
pemilik bisa menambah.

Pengeluaran **mengurangi laba bersih** pada tanggal itu dan dihitung sebagai
uang keluar. Belanja stok **bukan** pengeluaran (sudah dicatat sebagai
pembelian; nilainya masuk laporan lewat HPP, bukan saat belanja).

Pengeluaran bisa diedit/dihapus oleh pemilik (bukan transaksi stok, tidak ada
efek berantai).

---

## 8. Stok & mutasi stok

`products.stock` disimpan sebagai angka agar layar kasir cepat, tetapi **setiap
perubahan** wajib lewat tabel `stock_movements` dalam transaksi database yang sama.
Mutasi adalah sumber kebenaran; bila `products.stock` meleset, bisa dihitung
ulang dari Σ mutasi.

| Jenis mutasi | Tanda | Pemicu |
|---|:---:|---|
| `INITIAL` | + | Barang baru dibuat dengan stok awal (§3) |
| `PURCHASE` | + | Pembelian disimpan (§4) |
| `PURCHASE_VOID` | − | Pembelian dibatalkan |
| `SALE` | − | Penjualan disimpan (§5) |
| `SALE_VOID` | + | Penjualan dibatalkan |
| `STOCK_TAKE` | ± | Stok opname diselesaikan (§9) |

Setiap baris mutasi menyimpan: barang, jenis, qty (bertanda), stok sesudah,
harga modal saat itu, referensi dokumen (id pembelian/penjualan/opname),
pelaku, waktu.

**Harga modal** mengikuti rata-rata tertimbang (§4). Bila pembelian
dibatalkan, harga modal dihitung ulang dengan memutar ulang mutasi `INITIAL`
dan `PURCHASE` yang masih berlaku, urut waktu. Penjualan dan opname tidak
mengubah harga modal.

---

## 9. Stok opname (akhir bulan)

Status: **diimplementasi 30 Oktober 2026** (menu Master Data → Stok Opname).
Draf yang belum diselesaikan boleh **dihapus** (stok belum berubah). Barang
yang dibuat setelah draf dimulai tidak masuk draf itu. Selama draf, layar
hitung menampilkan stok sistem **terkini**, sama dengan angka yang dipakai saat
diselesaikan.

Pemilik mencocokkan stok fisik dengan sistem. Dilakukan saat warung tutup
agar angkanya tidak bergeser.

1. **Buat opname** (status `DRAFT`): aplikasi membuat satu baris per barang
   aktif dengan `system_qty` saat itu. Hanya boleh ada satu opname `DRAFT`.
2. **Hitung fisik**: pemilik mengisi `physical_qty` per barang, bisa bertahap
   (disimpan sebagai draf). Barang yang belum diisi dianggap belum dihitung.
   Selisih = physical_qty − system_qty. Selisih ≠ 0 wajib diberi alasan:
   `DAMAGED` (rusak), `EXPIRED` (kedaluwarsa), `LOST` (hilang), `PERSONAL_USE` (dipakai sendiri), `MISCOUNT` (salah catat), `OTHER` (lainnya).
3. **Selesaikan** (status `COMPLETED`): untuk setiap barang yang dihitung,
   `system_qty` **diambil ulang** dari nilai terkini (kalau ada penjualan
   selama opname berjalan), selisih dihitung ulang, lalu:
   - mutasi `STOCK_TAKE` sebesar selisih, `products.stock = physical_qty`;
   - **selisih kurang** → penyusutan = |selisih| × cost_price, dicatat sebagai
     kerugian pada tanggal opname (mengurangi laba bersih);
   - **selisih lebih** → hanya koreksi stok, tidak menambah laba (barang sudah
     dibayar sebelumnya; kelebihan ini adalah pencatatan yang kurang, bukan untung).
   Barang yang tidak dihitung tidak berubah.
4. Opname `COMPLETED` tidak bisa diubah. Salah hitung = buat opname baru.

Penjualan dan pembelian **tetap boleh** berjalan selama opname `DRAFT`
(warung tidak perlu berhenti), karena stok sistem diambil ulang di langkah 3.

---

## 10. Laporan & rumus

Status: **diimplementasi 30 Oktober 2026** (menu Laporan: harian, bulanan,
tahunan; unduh Excel untuk bulanan & tahunan; dashboard di beranda Pemilik
dengan periode bulan berjalan; untuk bulan lain buka laporan bulanan).

Semua tanggal memakai zona waktu warung (`APP_TIMEZONE`). Penjualan yang
dibatalkan dan pembelian yang dibatalkan **tidak** dihitung.

### 10.1 Rumus dasar (untuk satu periode)

```
Omset            = Σ subtotal penjualan (semua metode, termasuk bon)
HPP              = Σ cost_price × qty penjualan        ← uang modal yang harus diputar
Laba kotor       = Omset − HPP
Pengeluaran      = Σ pengeluaran operasional
Penyusutan       = Σ penyusutan dari opname COMPLETED dalam periode
Laba bersih      = Laba kotor − Pengeluaran − Penyusutan   ← uang laba

Uang masuk       = penjualan CASH + QRIS + pelunasan bon (tanggal pelunasan)
Uang keluar      = total pembelian + pengeluaran
Bon baru         = Σ penjualan CREDIT dalam periode
Piutang berjalan = Σ sisa bon yang belum lunas (semua periode, posisi saat ini)
```

### 10.2 Laporan harian

Pilih tanggal (bawaan: hari ini). Menampilkan rumus §10.1 untuk hari itu,
ditambah:

- jumlah transaksi, rata-rata per transaksi;
- rincian uang masuk per metode (tunai / QRIS / pelunasan bon);
- daftar transaksi hari itu (nomor, jam, kasir, total, metode, status);
- **barang terlaris** hari itu (qty dan laba kotor).

### 10.3 Laporan bulanan & tahunan

- **Bulanan**: pilih bulan. Angka §10.1 untuk bulan itu + tabel per hari
  (tanggal, omset, HPP, laba kotor, pengeluaran, laba bersih) + barang
  terlaris & laba per kategori.
- **Tahunan**: pilih tahun. Tabel per bulan dengan kolom yang sama, plus total
  tahun. Berguna untuk melihat bulan ramai/sepi.
- Keduanya bisa diekspor ke Excel.

### 10.4 Dashboard pemisahan dana (beranda Pemilik)

Periode bawaan: bulan berjalan, bisa diganti. Tiga kotak besar:

| Kotak | Isi | Arti untuk pemilik |
|---|---|---|
| **Uang modal (harus diputar)** | HPP periode ini | Sisihkan sebesar ini untuk belanja stok lagi; ini bukan untung. |
| **Uang laba (boleh diambil)** | Laba bersih periode ini | Yang benar-benar menjadi milik pemilik. |
| **Piutang (uang di luar)** | Piutang berjalan | Omset yang belum jadi uang; tagih. |

Di bawahnya: omset hari ini, grafik omset & laba bersih per hari dalam bulan
ini, daftar barang **perlu restock** (stok ≤ min_stock atau minus), dan bon
yang sudah lama belum dibayar (> 30 hari).

Catatan penting yang ditampilkan di dashboard: aplikasi **tidak melacak saldo
kas laci**. Angka "uang modal" dan "uang laba" adalah hasil perhitungan dari
transaksi, bukan uang yang terbukti ada di laci. Pencocokan kas fisik menjadi
tanggung jawab pemilik (lihat §13).

### 10.5 Beranda Kasir

Kasir tidak melihat laba. Beranda Kasir = tombol besar ke layar kasir,
ringkasan "transaksi saya hari ini" (jumlah & total omset), dan daftar bon
yang perlu ditagih.

---

## 11. Pengguna & akun

- Akun **Superadmin** dibuat lewat script saat deployment (`pnpm db:create-superadmin <email> <password> "<Nama>"`), karena tidak ada halaman daftar. Script aman dijalankan ulang (email sudah ada → hanya diperbarui).
- **Superadmin** membuat **toko** (nama, jenis usaha, alamat, telepon, zona waktu), lalu akun **Pemilik** untuk toko itu: nama, email, password sementara. Superadmin juga yang mereset password / menonaktifkan Pemilik, dan menonaktifkan toko (semua user toko itu tidak bisa login).
- **Pemilik** bisa mengubah data tokonya sendiri (nama, alamat, telepon, zona waktu), tetapi tidak bisa membuat toko lain.
- **Pemilik** membuat akun **Kasir**: nama, email, password sementara. Pemilik bisa menonaktifkan Kasir (tidak bisa login, riwayat transaksinya tetap) dan mereset password.
- Semua akun baru wajib mengganti password saat login pertama.
- **Pengiriman kredensial.** Password sementara selalu ditampilkan sekali ke pembuat akun, dengan tombol **Kirim undangan via WhatsApp** (otomatis lewat Fonnte ke nomor WhatsApp pengguna; pesan berisi alamat aplikasi, email, password sementara). Tombol hanya berlaku selama pengguna belum mengganti password sementaranya. Selain itu dikirim ke email pengguna, **kecuali** emailnya adalah *email syarat login*: pemilik/kasir yang tidak punya email didaftarkan dengan email buatan dari nama depannya (nama "Nita Aulia" → `nita@gmail.com`). Aturan deteksi: bagian sebelum `@` sama dengan kata pertama nama lengkap (tidak peka huruf besar/kecil, tanda baca diabaikan, domain tidak dicek). Email seperti itu dianggap tidak aktif dan tidak dikirimi apa pun. Berlaku juga untuk reset password.
- Akun Superadmin tidak pernah tampil di daftar pengguna.
- Login dibatasi (rate limit) untuk mencegah tebak password. Sesi "Ingat saya" 14 hari, tanpa itu 12 jam.
- Setiap transaksi (penjualan, pembelian, pembatalan, opname, pengeluaran) menyimpan siapa pelakunya.

---

## 12. Di luar cakupan v1 (rencana v2)

Sengaja **tidak** dibuat di v1 agar aplikasi cepat bisa dipakai:

- Multi-cabang (satu pemilik, banyak toko dalam satu akun) dan laporan gabungan.
- Langganan & pembayaran otomatis (v1: status toko aktif/nonaktif diatur Superadmin secara manual).
- Mode "lihat saja" Superadmin ke dalam toko klien.
- Barcode scanner.
- Data supplier dan hutang ke supplier.
- Cetak struk / kirim struk via WhatsApp.
- Konversi satuan (beli per dus, jual per pcs).
- Qty pecahan (jual per ons/½ kg → buat barang terpisah).
- Pembayaran campuran (sebagian tunai, sebagian bon).
- Diskon/promo per transaksi (kasir cukup mengubah harga jual per baris).
- Saldo kas laci & setoran/penarikan kas.
- Audit log lengkap seperti ArchiPay (v1 cukup kolom "dibuat oleh" di tiap transaksi).

---

## 13. Catatan terbuka

Hal yang belum diputuskan; tidak menghalangi v1 tetapi perlu jawaban sebelum fitur terkait dibuat.

1. **Saldo kas laci.** Tanpa pencatatan "modal awal laci" dan setoran/penarikan, aplikasi tidak bisa menjawab "uang di laci seharusnya berapa?". Opsi v1.1: tabel `cash_entries` sederhana (setor/tarik) + saldo = Σ uang masuk − Σ uang keluar ± setor/tarik.
2. **Kasir mencatat pembelian?** v1: hanya Pemilik. Kalau pemilik sering tidak di warung saat barang grosir datang, Kasir perlu hak `purchase:manage` tanpa melihat harga modal rata-rata—perlu dipikirkan tampilannya.
3. **Harga jual di bawah modal oleh Kasir.** v1 ditolak keras. Alternatif: boleh dengan peringatan dan tercatat untuk ditinjau pemilik.
4. **Pembatalan pembelian setelah barang terjual.** v1 ditolak; pemilik diarahkan ke opname. Apakah cukup?
5. **Retur barang dari pelanggan** (beli lalu kembalikan sebagian). v1: batalkan penjualan dan buat ulang. Kalau sering terjadi, perlu fitur retur per baris.
6. **Kedaluwarsa.** Tanggal kedaluwarsa per batch tidak dicatat (butuh FIFO per batch). Penyusutan karena kedaluwarsa cukup lewat opname.

---

## 14. Langganan

Status: **disepakati 28 Oktober 2026, diimplementasi 29 Oktober 2026** (menu
Langganan per toko, Tagihan & Pengaturan untuk Superadmin, pembayaran manual +
QRIS statis). Pengingat WhatsApp dan QRIS dinamis belum.

### 14.1 Aturan dasar

- **Masa gratis untuk semua toko baru**, lamanya diatur Superadmin di
  Pengaturan (saat ini **14 hari**) sejak toko dibuat. Tidak ada fitur
  "langganan gratis/bonus" terpisah (dihapus 29 Okt 2026).
- **Masa tenggang 3 hari** setelah jatuh tempo: toko masih bisa dipakai
  dengan spanduk peringatan. Lewat itu, akses ditutup (§14.3).
- **Menu "Langganan"** ada di setiap toko, **paling akhir** di kotak menu,
  berisi status langganan, pilihan paket, dan riwayat tagihan.
- **Harga paket** diatur Superadmin di **Pengaturan platform** (31 Okt
  2026, susunan sama dengan ArchiPay, tanpa batas pengguna): Superadmin
  mengisi **harga per bulan** + **diskon 6 bulan** & **diskon 1 tahun** (%).
  Harga 6 bulan & 1 tahun **dihitung otomatis**
  (`harga per bulan × N × (100 − diskon) / 100`, `features/subscriptions/pricing.ts`)
  dan ditampilkan di tabel simulasi; hasilnya disimpan sebagai **harga total
  per periode** di `subscription_plans`. Pemilik melihat "setara Rp x/bulan,
  hemat y %" dibanding paket bulanan. Harga per bulan 0 = paket belum dijual.
- **Harga khusus per toko** (hasil negosiasi tatap muka) diatur di detail
  toko → Langganan; bila ada, harga khusus menggantikan harga standar untuk
  toko itu.

### 14.2 Alur berlangganan

1. Pemilik membuka menu Langganan: tampil status (gratis s.d. tanggal,
   aktif s.d. tanggal, tenggang, atau habis) dan tiga kartu paket beserta
   harga yang berlaku untuk tokonya.
2. Pemilik memilih paket → tampil panel pembayaran: nominal, kartu tiap
   rekening bank SakuDagang (bisa lebih dari satu, diatur di Pengaturan;
   berjajar di layar lebar, bertumpuk di HP) dan/atau QRIS statis (gambar QR
   diunggah Superadmin di Pengaturan; bila tidak ada rekening, hanya QRIS yang
   tampil), dan form "Saya sudah bayar". **Memilih paket tidak menyimpan
   apa pun**; pindah menu atau "Ganti paket" cukup kembali ke pilihan paket,
   sehingga tidak ada tagihan sampah dari pemilik yang ragu-ragu.
3. Setelah membayar, Pemilik menekan **"Saya sudah bayar"** dan **wajib
   mengunggah bukti transfer** (foto/PDF) → **saat inilah tagihan tercatat**,
   langsung berstatus `CLAIMED` (menunggu konfirmasi). Harga dihitung ulang di
   server dari paket & harga khusus toko saat itu. Admin mendapat WhatsApp
   otomatis. Klaim ini **tidak mengubah akses toko**; bila ternyata belum
   bayar, pemilik tidak mendapat apa pun. Satu klaim terbuka per toko.
4. Satu tagihan bisa dibayar **beberapa kali** (tabel `subscription_payments`,
   satu baris per bukti). Superadmin melihat pembayaran yang menunggu di
   beranda ("Perlu konfirmasi") & menu Tagihan (tampil paling atas, bukti bisa
   dibuka), mencocokkan mutasi rekening, lalu untuk tiap pembayaran:
   - **Terima** dengan mengisi **nominal yang benar-benar masuk**. Total
     diterima ≥ harga → tagihan `ACTIVE` (lunas), masa berlangganan toko
     diperpanjang. Total < harga → tagihan **`UNDERPAID` (Kurang bayar)**:
     Pemilik melihat "diterima Rp X, kurang Rp Y" dan mengirim bukti
     kekurangan **pada tagihan yang sama** (tagihan kembali menunggu
     konfirmasi). Lebih bayar dicatat di keterangan admin untuk dikembalikan manual.
   - **Tolak** dengan alasan wajib (dana tidak masuk / bukti palsu). Bila
     tagihan belum pernah menerima pembayaran → tagihan `REJECTED` (Ditolak,
     status akhir; Pemilik mulai lagi dari pilihan paket). Bila sudah ada yang
     diterima → tagihan kembali `UNDERPAID`. Alasan tampil ke Pemilik dan
     tersimpan sebagai jejak bila ada perselisihan.
   Tidak ada tombol batalkan, baik untuk admin maupun pemilik: setiap baris
   tagihan adalah klaim dengan bukti. Tampilan tidak menyebut nama pengguna
   pelaku (keputusan user 29 Okt 2026). Contoh: paket Rp 100.000, transfer
   Rp 50.000 → admin terima Rp 50.000 → kurang bayar Rp 50.000 → pemilik
   transfer sisanya dan kirim bukti → admin terima → lunas.
   Superadmin juga bisa **mencatat pembayaran langsung** dari halaman detail
   toko (pemilik membayar tunai/transfer saat kunjungan) → langsung `ACTIVE`.
5. **Perpanjangan** dihitung dari tanggal berakhir yang sedang berjalan bila
   masih di masa depan; bila sudah habis (termasuk saat masa tenggang), dari
   tanggal ditandai lunas. Toko yang membayar lebih awal tidak dirugikan.
6. Pembayaran otomatis (QRIS dinamis / VA lewat payment gateway) = tahap
   berikutnya; lihat §14.7.

### 14.3 Saat akses ditutup (login terbatas)

Setelah masa tenggang lewat (`subscription_until` + masa tenggang, saat ini
3 hari, < sekarang):

- **Pemilik masih bisa login**; semua menu tetap tampil (dengan ikon gembok),
  tetapi hanya **Langganan** yang bisa dibuka. Mengklik menu lain membuka
  halaman Langganan dengan pesan "Menu Barang belum bisa dibuka, pilih paket
  dan lakukan pembayaran". Setelah lunas dikonfirmasi admin, semua menu
  terbuka lagi dan masa aktif dihitung dari tanggal lunas.
- **Kasir tidak bisa login**: layar login menampilkan "Masa berlangganan toko
  habis, hubungi pemilik toko".
- Superadmin tetap bisa masuk ke toko itu seperti biasa.

Pengecekan dilakukan saat login & setiap request (`lib/auth/dal.ts`) dari
kolom `stores.subscription_until`, jadi **tidak perlu job harian**.
`stores.is_active` tetap ada sebagai saklar manual Superadmin (toko
bermasalah) dan terpisah dari langganan: toko nonaktif = semua user tidak
bisa masuk, apa pun status langganannya.

### 14.4 Pengingat & tampilan

- Spanduk di dalam aplikasi untuk Pemilik mulai **H-7** sebelum masa gratis
  atau langganan habis, dan selama masa tenggang (merah).
- Halaman Toko Superadmin: chip **"Segera habis"** (≤ 7 hari) dan pita
  **"Tagihan menunggu konfirmasi"**; kartu toko menampilkan "Gratis s.d. …" /
  "Aktif s.d. …" / "Habis …, tenggang s.d. …" / "Habis sejak …".
- Header menampilkan masa aktif toko sejak hari pertama ("Gratis s.d. 12 Nov").
- WhatsApp ke semua Pemilik toko setiap kali admin memeriksa pembayaran:
  **lunas** (masa aktif diperpanjang sampai tanggal …), **kurang bayar**
  (diterima Rp X, kurang Rp Y), atau **ditolak** (beserta alasan), dengan
  tautan ke menu Langganan (`features/subscriptions/notifications.ts`).
- Pengingat WhatsApp ke semua Pemilik toko **H-3 dan H-1** sebelum masa
  berakhir, dikirim cron harian `/api/cron/subscription-reminders`
  (`features/subscriptions/reminders.ts`); `stores.last_reminder_key`
  mencegah kiriman dobel.

### 14.5 Data

| Tabel | Isi |
|---|---|
| `subscription_plans` | Paket standar: `months` (1/6/12), `price`, `is_active`. Diubah di Pengaturan. |
| `store_plan_prices` | Harga khusus per toko: `store_id`, `months`, `price`, `note` ("negosiasi 12 Nov 2026"). |
| `subscriptions` | Satu baris per tagihan/periode: `store_id`, `months`, `price` (snapshot), `amount_paid` (Σ diterima), `starts_at`, `ends_at`, `status` (CLAIMED/UNDERPAID/ACTIVE/REJECTED; PENDING & CANCELLED hanya baris lama), `paid_at`, `note`, `rejected_at`, `rejection_note`, `confirmed_by_id`, `created_by_id`. |
| `subscription_payments` | Satu baris per bukti transfer: `subscription_id`, `store_id`, `status` (PENDING/ACCEPTED/REJECTED), `proof_key` (folder `YYYY-MM/bukti-transfer/…` di R2), `note` (pemilik), `amount_received` & `review_note` (diisi admin), `reviewed_at`, `reviewed_by_id`, `created_by_id`. |
| `platform_settings` | Satu baris: nomor WA admin, gambar QRIS statis, masa gratis (hari), masa tenggang (hari, 3), diskon paket 6 bulan & 1 tahun (%, bawaan 10 & 20). Rekening ada di `payment_bank_accounts`. |
| `stores` (+kolom) | `subscription_until` (timestamp): akhir masa gratis/langganan; diisi saat toko dibuat (= created_at + masa gratis) dan setiap tagihan lunas. |

Harga di `subscriptions` adalah **snapshot**: mengubah harga paket/harga
khusus tidak mengubah tagihan yang sudah dibuat. Status `EXPIRED` tidak
disimpan: "habis" dihitung dari `ends_at` vs sekarang.

### 14.6 Status langganan toko (turunan, dihitung di `features/subscriptions/service.ts`)

| Status | Syarat | Akibat |
|---|---|---|
| TRIAL | belum pernah ada tagihan lunas, `subscription_until` ≥ sekarang | normal, spanduk H-7 |
| ACTIVE | ada tagihan lunas, `subscription_until` ≥ sekarang | normal, spanduk H-7 |
| GRACE | `subscription_until` < sekarang ≤ `subscription_until` + 3 hari | normal, spanduk merah |
| EXPIRED | lewat masa tenggang | login terbatas (§14.3) |

### 14.7 QRIS otomatis (tahap berikutnya)

Dua jenis QRIS:

- **QRIS statis** (dipakai tahap pertama): satu gambar QR tetap milik merchant
  SakuDagang, nominal diketik pembayar. Tidak ada pemberitahuan ke aplikasi;
  Superadmin mencocokkan manual. Persiapan: daftar merchant QRIS di bank atau
  e-wallet bisnis, unggah gambar QR di Pengaturan.
- **QRIS dinamis** lewat payment gateway (Midtrans, Xendit, Doku, dll.):
  aplikasi membuat tagihan ke gateway, gateway mengembalikan QR berisi nominal
  pasti, pembayar memindai, gateway memanggil **webhook** aplikasi
  (`app/api/payments/webhook/route.ts`) → tagihan otomatis `ACTIVE` tanpa
  campur tangan Superadmin. Persiapan: akun merchant gateway (KTP/NPWP, data
  usaha, rekening settlement), domain HTTPS publik untuk webhook, kunci API
  di env, pengujian di sandbox. Biaya MDR QRIS dipotong per transaksi,
  dana masuk ke rekening T+1 s.d. T+2.
