# Alur Bisnis SakuSembako

Acuan untuk memahami cara kerja SakuSembako: pencatatan **kasir**, **stok
barang**, dan **laporan keuangan** warung sembako. Tujuan aplikasi: pemilik
warung tahu omset harian, laba rugi, dan bisa memisahkan **uang modal** (yang
harus diputar lagi untuk belanja stok) dari **uang laba** (yang boleh diambil).

Dokumen ini menjelaskan aturan bisnis; struktur kode ada di
[ARCHITECTURE.md](./ARCHITECTURE.md). Satu deployment = satu warung.

Status: **draf v1, disepakati 28 Oktober 2026, belum diimplementasi.** Setelah
kode jadi, tabel "sumber kebenaran" di bawah diisi dengan nama file-nya.

| Aturan | File (rencana) |
|---|---|
| Hak akses per peran | `src/lib/auth/permissions.ts` |
| Rumus harga modal rata-rata, laba | `src/features/barang/service.ts`, `src/features/penjualan/service.ts` |
| Daftar & arti status | `src/features/*/constants.ts` |
| Rumus laporan | `src/features/laporan/service.ts` |

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

- **Superadmin** = developer/pengelola aplikasi, bukan orang warung. Dibuat
  lewat script saat deployment (`pnpm db:buat-superadmin`), **tidak muncul di
  daftar pengguna**, dan tidak bisa diubah/dinonaktifkan oleh Pemilik. Tugas
  utamanya membuat akun Pemilik dan membantu bila ada masalah teknis.
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
| Pengguna: buat/nonaktifkan **Kasir**, reset password | ✓ | ✓ | |
| Pengguna: buat/nonaktifkan **Pemilik**, reset password | ✓ | | |
| Melihat & mengelola akun Superadmin | script saja | | |

Superadmin diberi semua hak operasional agar bisa membantu Pemilik (mis.
mengecek laporan saat ada keluhan), tetapi **bukan** untuk dipakai
sehari-hari: transaksi yang dibuat Superadmin tetap tercatat atas namanya,
sehingga terlihat di riwayat.

Alasan Kasir tidak melihat harga modal: margin warung adalah informasi pemilik.
Layar kasir hanya menampilkan harga jual.

Permission (format `<sumber-daya>:<aksi>`), rencana:

```
penjualan:catat      penjualan:batal-sendiri   penjualan:batal-semua
bon:lunasi           pelanggan:kelola
barang:lihat         barang:kelola             barang:lihat-modal
pembelian:kelola     pengeluaran:kelola        opname:kelola
laporan:lihat        pengguna:kelola-kasir     pengguna:kelola-pemilik
```

Kasir: `penjualan:catat`, `penjualan:batal-sendiri`, `bon:lunasi`,
`pelanggan:kelola`, `barang:lihat`.
Pemilik: semuanya kecuali `pengguna:kelola-pemilik`.
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
| nama | Unik. Contoh: "Minyak Goreng 1 L", "Gula ½ kg". |
| kategori | Dari daftar kategori (Sembako, Minuman, Rokok, Kebutuhan rumah, dst). Pemilik bisa menambah. |
| satuan | Teks bebas pendek: pcs, kg, bungkus, botol, sachet. Hanya label; **qty selalu bilangan bulat**. |
| harga_modal | Rata-rata tertimbang, **dihitung otomatis** dari pembelian. Boleh diisi manual hanya saat barang pertama dibuat (stok awal). |
| harga_jual | Diatur pemilik. Bisa diubah kapan saja; penjualan lama tidak berubah karena menyimpan snapshot. |
| stok | Jumlah saat ini. Diubah hanya lewat mutasi stok (§8), tidak pernah diedit langsung. |
| stok_minimum | Opsional. Bila stok ≤ ini, barang masuk daftar "Perlu restock". |
| aktif | Barang nonaktif tidak muncul di kasir, tetapi riwayatnya tetap ada. Barang **tidak pernah dihapus** bila sudah pernah dipakai di transaksi. |

**Stok awal.** Saat membuat barang baru yang sudah punya stok fisik, pemilik
mengisi stok awal + harga modal awal. Ini dicatat sebagai mutasi stok jenis
`STOK_AWAL`, sehingga nilainya ikut masuk perhitungan rata-rata berikutnya.

---

## 4. Pembelian (barang masuk)

Pemilik mencatat satu kali belanja: tanggal, catatan (mis. "Belanja di
grosir Pak Haji"), dan daftar barang dengan **qty** dan **harga beli per
satuan**. Total pembelian = Σ harga beli × qty = **modal keluar** pada tanggal
itu.

Saat disimpan, untuk setiap barang (dalam satu transaksi database):

1. Harga modal baru dihitung rata-rata tertimbang, dibulatkan ke rupiah:

   ```
   harga_modal_baru = (stok_lama × harga_modal_lama + qty_beli × harga_beli)
                      ÷ (stok_lama + qty_beli)
   ```

   Contoh: stok 10 @ Rp17.000, beli 20 @ Rp18.500 →
   (170.000 + 370.000) ÷ 30 = **Rp18.000**.

   Bila stok lama ≤ 0 (habis atau minus), harga modal baru = harga beli
   (rata-rata dengan stok minus tidak masuk akal).

2. Mutasi stok `PEMBELIAN` +qty, stok barang bertambah.
3. Opsional: pemilik bisa langsung mengisi **harga jual baru** di baris
   pembelian (harga grosir naik → harga jual ikut naik). Kosong = tidak berubah.

Baris pembelian menyimpan `harga_beli` dan `harga_modal_sebelum/sesudah`
sebagai jejak.

**Mengubah/membatalkan pembelian.** Pembelian yang sudah tersimpan **tidak bisa
diedit**; bila salah, pemilik membatalkannya (status `DIBATALKAN`). Pembatalan
membuat mutasi stok `PEMBELIAN_BATAL` −qty dan **menghitung ulang harga
modal** dari riwayat (lihat §8). Pembatalan ditolak bila akan membuat stok
negatif melebihi yang terjual sejak pembelian itu—pesan: "Barang dari
pembelian ini sudah terjual, buat penyesuaian lewat stok opname."

Biaya belanja di luar harga barang (bensin, parkir, ongkos angkut) **bukan**
bagian pembelian; dicatat di Pengeluaran (§7).

---

## 5. Kasir (penjualan)

Layar utama Kasir, dioptimalkan untuk HP: cari barang (nama), tambah ke
keranjang, ubah qty, pilih metode bayar, simpan. Satu transaksi = satu
penjualan dengan nomor `JL-YYYY-MM-NNNN`.

### 5.1 Baris penjualan

Setiap baris menyimpan **snapshot** saat transaksi, bukan referensi ke master:

| Kolom | Isi |
|---|---|
| barang_id, nama_barang | Nama ikut disalin agar laporan tetap terbaca bila barang diganti nama. |
| qty | Bilangan bulat ≥ 1. |
| harga_jual | Harga jual master saat itu. Kasir **boleh mengubah** untuk satu transaksi (diskon/pembulatan), tetapi tidak boleh di bawah harga modal—pemilik bisa, kasir tidak. |
| harga_modal | Harga modal master saat itu. Tidak tampil untuk Kasir. |
| subtotal | harga_jual × qty. |
| laba_kotor | (harga_jual − harga_modal) × qty. |

Total penjualan = Σ subtotal. Laba kotor penjualan = Σ laba_kotor.

### 5.2 Metode bayar

| Metode | Akibat |
|---|---|
| `TUNAI` | Uang masuk kas hari itu. Kasir mengisi "uang diterima", aplikasi menghitung kembalian. |
| `QRIS` | Uang masuk (non-tunai) hari itu. |
| `BON` | Wajib pilih **pelanggan**. Penjualan berstatus bayar `BELUM_LUNAS`, menjadi piutang (§6). |

Satu penjualan hanya satu metode. Bayar sebagian tunai + sisanya bon tidak
didukung di v1 (buat dua transaksi).

### 5.3 Stok saat menjual

- Stok dipotong **saat transaksi disimpan** (mutasi `PENJUALAN` −qty), bukan saat barang masuk keranjang.
- **Stok minus diperbolehkan.** Warung sering punya barang fisik yang belum tercatat. Kasir melihat peringatan "Stok sistem: 0" tetapi tetap bisa menyimpan. Stok minus muncul merah di daftar barang dan diluruskan saat opname (§9) atau pembelian.
- Barang nonaktif tidak bisa dijual.

### 5.4 Pembatalan (void)

Penjualan yang sudah tersimpan **tidak bisa diedit**; salah input = batalkan,
lalu buat yang baru.

- Kasir: hanya penjualan **miliknya sendiri** pada **hari yang sama** (tanggal menurut `APP_TIMEZONE`).
- Pemilik: penjualan apa pun, kapan pun.
- Wajib mengisi alasan.
- Akibat: status `DIBATALKAN`, mutasi stok `PENJUALAN_BATAL` +qty per baris, omset/laba hari itu berkurang. Bon yang sudah ada pelunasannya **tidak bisa** dibatalkan (batalkan pelunasannya dulu).
- Penjualan yang dibatalkan tetap tampil di riwayat (dicoret), tidak dihapus.

---

## 6. Bon (piutang pelanggan)

| Hal | Aturan |
|---|---|
| Pelanggan | Nama (wajib), nomor HP (opsional), catatan. Kasir boleh menambah pelanggan baru dari layar kasir. |
| Omset | Penjualan bon **tetap dihitung omset dan laba** pada tanggal penjualan (uang belum masuk, tapi barang sudah keluar). Laporan memisahkan "omset" dan "uang masuk". |
| Pelunasan | Bisa sebagian atau penuh, metode `TUNAI`/`QRIS`, tanggal pelunasan. Satu pelunasan dialokasikan ke **satu** penjualan bon (pilih bon mana yang dibayar). Setelah total pelunasan = total penjualan → status bayar `LUNAS`. |
| Uang masuk | Pelunasan dihitung sebagai uang masuk pada tanggal pelunasan, **bukan** omset (omset sudah dihitung saat jual). |
| Daftar piutang | Per pelanggan: total bon, total dibayar, sisa. Pemilik dan Kasir melihat daftar ini. |
| Batas bon | Tidak ada pembatasan otomatis di v1. Pemilik bisa menandai pelanggan "tidak boleh bon" (flag `boleh_bon = false`). |

---

## 7. Pengeluaran operasional

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

`barang.stok` disimpan sebagai angka agar layar kasir cepat, tetapi **setiap
perubahan** wajib lewat tabel `mutasi_stok` dalam transaksi database yang sama.
Mutasi adalah sumber kebenaran; bila `barang.stok` meleset, bisa dihitung
ulang dari Σ mutasi.

| Jenis mutasi | Tanda | Pemicu |
|---|:---:|---|
| `STOK_AWAL` | + | Barang baru dibuat dengan stok awal (§3) |
| `PEMBELIAN` | + | Pembelian disimpan (§4) |
| `PEMBELIAN_BATAL` | − | Pembelian dibatalkan |
| `PENJUALAN` | − | Penjualan disimpan (§5) |
| `PENJUALAN_BATAL` | + | Penjualan dibatalkan |
| `OPNAME` | ± | Stok opname diselesaikan (§9) |

Setiap baris mutasi menyimpan: barang, jenis, qty (bertanda), stok sesudah,
harga modal saat itu, referensi dokumen (id pembelian/penjualan/opname),
pelaku, waktu.

**Harga modal** mengikuti rata-rata tertimbang (§4). Bila pembelian
dibatalkan, harga modal dihitung ulang dengan memutar ulang mutasi `STOK_AWAL`
dan `PEMBELIAN` yang masih berlaku, urut waktu. Penjualan dan opname tidak
mengubah harga modal.

---

## 9. Stok opname (akhir bulan)

Pemilik mencocokkan stok fisik dengan sistem. Dilakukan saat warung tutup
agar angkanya tidak bergeser.

1. **Buat opname** (status `DRAF`): aplikasi membuat satu baris per barang
   aktif dengan `stok_sistem` saat itu. Hanya boleh ada satu opname `DRAF`.
2. **Hitung fisik**: pemilik mengisi `stok_fisik` per barang, bisa bertahap
   (disimpan sebagai draf). Barang yang belum diisi dianggap belum dihitung.
   Selisih = stok_fisik − stok_sistem. Selisih ≠ 0 wajib diberi alasan:
   `RUSAK`, `KEDALUWARSA`, `HILANG`, `DIPAKAI_SENDIRI`, `SALAH_CATAT`, `LAINNYA`.
3. **Selesaikan** (status `SELESAI`): untuk setiap barang yang dihitung,
   `stok_sistem` **diambil ulang** dari nilai terkini (kalau ada penjualan
   selama opname berjalan), selisih dihitung ulang, lalu:
   - mutasi `OPNAME` sebesar selisih, `barang.stok = stok_fisik`;
   - **selisih kurang** → penyusutan = |selisih| × harga_modal, dicatat sebagai
     kerugian pada tanggal opname (mengurangi laba bersih);
   - **selisih lebih** → hanya koreksi stok, tidak menambah laba (barang sudah
     dibayar sebelumnya; kelebihan ini adalah pencatatan yang kurang, bukan untung).
   Barang yang tidak dihitung tidak berubah.
4. Opname `SELESAI` tidak bisa diubah. Salah hitung = buat opname baru.

Penjualan dan pembelian **tetap boleh** berjalan selama opname `DRAF`
(warung tidak perlu berhenti), karena stok sistem diambil ulang di langkah 3.

---

## 10. Laporan & rumus

Semua tanggal memakai zona waktu warung (`APP_TIMEZONE`). Penjualan yang
dibatalkan dan pembelian yang dibatalkan **tidak** dihitung.

### 10.1 Rumus dasar (untuk satu periode)

```
Omset            = Σ subtotal penjualan (semua metode, termasuk bon)
HPP              = Σ harga_modal × qty penjualan        ← uang modal yang harus diputar
Laba kotor       = Omset − HPP
Pengeluaran      = Σ pengeluaran operasional
Penyusutan       = Σ penyusutan dari opname SELESAI dalam periode
Laba bersih      = Laba kotor − Pengeluaran − Penyusutan   ← uang laba

Uang masuk       = penjualan TUNAI + QRIS + pelunasan bon (tanggal pelunasan)
Uang keluar      = total pembelian + pengeluaran
Bon baru         = Σ penjualan BON dalam periode
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
ini, daftar barang **perlu restock** (stok ≤ stok_minimum atau minus), dan bon
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

- Akun **Superadmin** dibuat lewat script saat deployment (`pnpm db:buat-superadmin <email> <password> "<Nama>"`), karena tidak ada halaman daftar. Script aman dijalankan ulang (email sudah ada → hanya diperbarui).
- **Superadmin** membuat akun **Pemilik**: nama, email, password sementara. Superadmin juga yang mereset password / menonaktifkan Pemilik.
- **Pemilik** membuat akun **Kasir**: nama, email, password sementara. Pemilik bisa menonaktifkan Kasir (tidak bisa login, riwayat transaksinya tetap) dan mereset password.
- Semua akun baru wajib mengganti password saat login pertama.
- Akun Superadmin tidak pernah tampil di daftar pengguna.
- Login dibatasi (rate limit) untuk mencegah tebak password. Sesi "Ingat saya" 14 hari, tanpa itu 12 jam.
- Setiap transaksi (penjualan, pembelian, pembatalan, opname, pengeluaran) menyimpan siapa pelakunya.

---

## 12. Di luar cakupan v1 (rencana v2)

Sengaja **tidak** dibuat di v1 agar aplikasi cepat bisa dipakai:

- Multi-warung / cabang.
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

1. **Saldo kas laci.** Tanpa pencatatan "modal awal laci" dan setoran/penarikan, aplikasi tidak bisa menjawab "uang di laci seharusnya berapa?". Opsi v1.1: tabel `kas` sederhana (setor/tarik) + saldo = Σ uang masuk − Σ uang keluar ± setor/tarik.
2. **Kasir mencatat pembelian?** v1: hanya Pemilik. Kalau pemilik sering tidak di warung saat barang grosir datang, Kasir perlu hak `pembelian:kelola` tanpa melihat harga modal rata-rata—perlu dipikirkan tampilannya.
3. **Harga jual di bawah modal oleh Kasir.** v1 ditolak keras. Alternatif: boleh dengan peringatan dan tercatat untuk ditinjau pemilik.
4. **Pembatalan pembelian setelah barang terjual.** v1 ditolak; pemilik diarahkan ke opname. Apakah cukup?
5. **Retur barang dari pelanggan** (beli lalu kembalikan sebagian). v1: batalkan penjualan dan buat ulang. Kalau sering terjadi, perlu fitur retur per baris.
6. **Kedaluwarsa.** Tanggal kedaluwarsa per batch tidak dicatat (butuh FIFO per batch). Penyusutan karena kedaluwarsa cukup lewat opname.
