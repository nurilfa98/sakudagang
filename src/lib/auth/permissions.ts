// SATU-SATUNYA tempat untuk mengatur "role apa boleh melakukan apa" (RBAC).
//
// Kode di halaman dan Server Action TIDAK mengecek role secara langsung
// (`roles.includes("ADMIN")`), melainkan mengecek permission:
//
//     await requirePermission("product:manage");   // di server (lib/auth/dal.ts)
//     can(user, "product:manage")                   // untuk menampilkan/menyembunyikan UI
//
// Jadi kalau suatu hari role lain boleh melakukan hal yang sama, cukup ubah
// ROLE_PERMISSIONS di bawah, tanpa mencari-cari pengecekan di seluruh kode.
//
// File ini tidak memakai `server-only` karena Client Component juga memakainya
// (misalnya sidebar menyembunyikan menu). Menyembunyikan menu hanya soal
// tampilan; pengaman sebenarnya tetap requirePermission() di server.
//
// Belum ada permission. Contoh mengisi (bersama roles.ts):
//
//   export const PERMISSIONS = ["product:view", "product:manage"] as const;
//   const ROLE_PERMISSIONS = {
//     ADMIN: PERMISSIONS,
//     STAFF: ["product:view"],
//   } satisfies Record<Role, readonly Permission[]>;
//
// Referensi:
// - node_modules/next/dist/docs/01-app/02-guides/authentication.md (bagian "Authorization")
// - https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

import type { Role } from "./roles";

// Format penamaan: "<sumber-daya>:<aksi>".
export const PERMISSIONS = [] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS = {} satisfies Record<Role, readonly Permission[]>;

// User dengan banyak role mendapat gabungan permission dari semua role-nya.
export function can(user: { roles: readonly Role[] }, permission: Permission) {
  return user.roles.some((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission));
}
