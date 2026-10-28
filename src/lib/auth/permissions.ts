// SATU-SATUNYA tempat untuk mengatur "role apa boleh melakukan apa" (RBAC).
//
// Kode di halaman dan Server Action TIDAK mengecek role secara langsung
// (`roles.includes("OWNER")`), melainkan mengecek permission:
//
//     await requirePermission("product:manage");   // di server (lib/auth/dal.ts)
//     can(user, "product:view-cost")                // untuk menampilkan/menyembunyikan UI
//
// Jadi kalau suatu hari Kasir boleh mencatat pembelian, cukup ubah
// ROLE_PERMISSIONS di bawah, tanpa mencari-cari pengecekan di seluruh kode.
//
// File ini tidak memakai `server-only` karena Client Component juga memakainya
// (misalnya sidebar menyembunyikan menu). Menyembunyikan menu hanya soal
// tampilan; pengaman sebenarnya tetap requirePermission() di server.
//
// Tabel hak akses lengkap: docs/BUSINESS-FLOW.md §2.
//
// Referensi:
// - node_modules/next/dist/docs/01-app/02-guides/authentication.md (bagian "Authorization")
// - https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

import type { Role } from "./roles";

// Format penamaan: "<sumber-daya>:<aksi>".
export const PERMISSIONS = [
  "sale:create", // layar kasir: mencatat penjualan tunai/QRIS/bon
  "sale:void-own", // membatalkan penjualan miliknya, hari yang sama
  "sale:void-all", // membatalkan penjualan siapa pun, kapan pun
  "credit:settle", // mencatat pelunasan bon pelanggan
  "customer:manage", // tambah/ubah data pelanggan
  "product:view", // daftar barang, harga jual, stok
  "product:view-cost", // melihat harga modal & laba (bukan untuk Kasir)
  "product:manage", // master barang & kategori
  "purchase:manage", // barang masuk
  "expense:manage", // biaya operasional
  "stock-take:manage", // stok opname
  "report:view", // laporan harian/bulanan/tahunan & dashboard
  "user:manage-cashier", // buat/nonaktifkan Kasir, reset password Kasir
  "user:manage-owner", // buat/nonaktifkan Pemilik (hanya Superadmin)
  "store:manage", // buat/nonaktifkan toko (hanya Superadmin)
  "store:edit-own", // ubah data toko sendiri (nama, alamat, zona waktu)
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Hanya untuk Superadmin: mengelola tenant & pemilik.
const PLATFORM_PERMISSIONS: readonly Permission[] = ["user:manage-owner", "store:manage"];

// `satisfies` memastikan setiap role terdaftar dan setiap permission valid.
const ROLE_PERMISSIONS = {
  SUPERADMIN: PERMISSIONS,
  OWNER: PERMISSIONS.filter((permission) => !PLATFORM_PERMISSIONS.includes(permission)),
  CASHIER: ["sale:create", "sale:void-own", "credit:settle", "customer:manage", "product:view"],
} satisfies Record<Role, readonly Permission[]>;

// User dengan banyak role mendapat gabungan permission dari semua role-nya.
export function can(user: { roles: readonly Role[] }, permission: Permission) {
  return user.roles.some((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission));
}
