# Database

Folder ini berisi **migration** PostgreSQL yang dibuat oleh drizzle-kit.
Sumber kebenaran struktur tabel adalah `src/lib/db/schema.ts`; file SQL di
sini adalah riwayat perubahannya, dijalankan berurutan ke setiap database.
Penjelasan "kenapa" tiap tabel ada di `docs/DATABASE-SCHEMA.md`.

```
database/
└── migrations/
    ├── 0000_….sql …              # perubahan struktur, urut dari yang paling lama
    └── meta/
        ├── _journal.json          # daftar & urutan migration (dibaca drizzle-kit)
        └── NNNN_snapshot.json     # potret schema setelah tiap migration
```

Lokasi folder diatur di `drizzle.config.ts` (`out: "./database/migrations"`).

## Persiapan pertama kali

1. Buat database kosong di PostgreSQL, misal `sakusembako`.
2. Isi `DATABASE_URL` di `.env`.
3. Jalankan semua migration: `pnpm db:migrate`
4. Buat akun Superadmin: `pnpm db:create-superadmin <email> <password> "<Nama>"`
5. Login, lalu buat akun Pemilik dari halaman Pengguna.

## Cara mengubah struktur database

1. Ubah tabel/kolom di `src/lib/db/schema.ts`.
2. Buat migration baru:

   ```bash
   pnpm db:generate --name=nama_singkat_perubahan
   ```

3. **Periksa file SQL yang dihasilkan.** Bila perubahan butuh mengisi atau
   memindahkan data lama (misal kolom baru yang `NOT NULL`), sunting file
   tersebut dan tandai bagian tambahan dengan komentar
   `-- Ditambahkan manual: …` beserta alasannya.
4. Jalankan ke database:

   ```bash
   pnpm db:migrate
   ```

5. Commit file SQL **dan** perubahan di `meta/` bersama perubahan `schema.ts`.

## Aturan

- **Jangan mengubah, mengganti nama, atau menghapus migration yang sudah dijalankan** di database mana pun (terutama production). drizzle-kit mencatat migration yang sudah dijalankan di tabel `drizzle.__drizzle_migrations`; perubahan berikutnya selalu dibuat sebagai migration baru.
- Jangan menyunting `meta/` secara manual. File di sana dibuat dan dibaca drizzle-kit.
- Data awal yang wajib ada diisi lewat migration, sehingga database baru langsung siap setelah `pnpm db:migrate`. Data per toko (kategori) diisi saat toko dibuat, bukan migration.

## Riwayat migration

| File | Isi |
|---|---|
| `0000_quick_boomer` | Tabel `roles`, `users`, `user_roles`, `login_attempts`. Nama acak bawaan drizzle-kit, dibiarkan agar riwayat tidak berubah. |
| `0001_stores` | Tabel `stores` (tenant) dan kolom `users.store_id` (null hanya untuk SUPERADMIN). |
| `0002_seed_roles` | *Manual (custom):* isi `roles` SUPERADMIN, OWNER, CASHIER. Tidak relevan lagi setelah `0003`, dibiarkan karena sudah dijalankan. |
| `0003_users_role_column` | Kolom `users.role` (varchar + CHECK) menggantikan tabel `roles` & `user_roles`. *Manual:* salin role lama ke kolom baru sebelum tabel lama dihapus. |
| `0004_users_phone` | Kolom `users.phone` (nomor WhatsApp, format `62…`) untuk undangan login. |
| `0005_products` | Tabel `product_categories`, `products`, `stock_movements`. *Manual:* kategori awal untuk toko yang sudah ada. |
| `0014_purchases` | Tabel `purchases`, `purchase_items` (pembelian / barang masuk) dan `document_sequences` (nomor BL-/JL-/SO- per toko per bulan). |
