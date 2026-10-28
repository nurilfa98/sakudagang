// DAL (Data Access Layer) untuk autentikasi & otorisasi.
//
// Ini SATU-SATUNYA tempat yang memutuskan "siapa user yang sedang login dan
// apa haknya". Semua page, query, dan Server Action yang butuh user wajib
// lewat sini, bukan membaca cookie sendiri-sendiri.
//
// - Autentikasi = memastikan siapa Anda       → verifySession()
// - Otorisasi   = memastikan Anda boleh apa   → requirePermission()
//   (daftar "role apa boleh apa" ada di lib/auth/permissions.ts)
//
// Referensi:
// - node_modules/next/dist/docs/01-app/02-guides/authentication.md
//   (bagian "Creating a Data Access Layer (DAL)" & "Using Data Transfer Objects (DTO)")
// - node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md
//   (bagian "Step 1: Read the current user")

import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { roles, stores, userRoles, users } from "@/lib/db/schema";
import { can, type Permission } from "./permissions";
import { isRole, type Role } from "./roles";
import { getSession } from "./session";

// DTO (Data Transfer Object): hanya field yang aman & dibutuhkan UI.
// password_hash TIDAK ikut.
export type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  roles: Role[];
  mustChangePassword: boolean;
  // Toko tempat user bekerja; null hanya untuk SUPERADMIN. Semua query &
  // action fitur bisnis WAJIB membatasi data ke storeId ini (multi-tenant).
  storeId: string | null;
};

// 'use cache: private' = cache khusus data milik satu user (membaca cookie).
//
// 1. Dalam satu request, layout, page, dan komponen lain yang memanggil
//    getCurrentUser() memakai hasil yang sama: query database cukup sekali.
// 2. Hasil render yang bergantung pada user ini boleh ikut di-PREFETCH dan
//    disimpan di memori browser user itu sendiri, sehingga navigasi terasa instan.
//
// Hasilnya TIDAK disimpan di cache server (tidak bisa bocor ke user lain).
// cacheLife("minutes") → browser boleh memakai hasil prefetch paling lama 5 menit.
// Konsekuensinya, user yang dinonaktifkan masih bisa MELIHAT halaman yang sudah
// ter-prefetch selama itu, tetapi tidak bisa mengubah data, karena setiap
// Server Action mengecek ulang ke server.
//
// Referensi:
// - node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache-private.md
// - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md
export async function getCurrentUser(): Promise<CurrentUser | null> {
  "use cache: private";
  cacheLife("minutes");

  const { userId, sessionVersion } = await getSession();
  if (!userId) return null;

  // Cookie session tetap valid sampai kedaluwarsa walau user sudah
  // dinonaktifkan. Karena itu status user selalu dicek ulang ke database.
  // Toko ikut di-join: user dari toko yang dinonaktifkan (langganan berhenti)
  // tidak bisa masuk walau akunnya sendiri masih aktif.
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      sessionVersion: users.sessionVersion,
      storeId: users.storeId,
      storeIsActive: stores.isActive,
    })
    .from(users)
    .leftJoin(stores, eq(users.storeId, stores.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.isActive) return null;
  if (user.storeId && !user.storeIsActive) return null;
  // Password sudah diganti/di-reset setelah cookie ini dibuat → login ulang.
  if (user.sessionVersion !== sessionVersion) return null;

  const roleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    roles: roleRows.map((r) => r.name).filter(isRole),
    mustChangePassword: user.mustChangePassword,
    storeId: user.storeId,
  };
}

// Untuk halaman/aksi fitur bisnis yang datanya milik SATU toko. Mengembalikan
// user beserta storeId yang pasti terisi, sehingga query bisa langsung
// `where(eq(products.storeId, storeId))`. SUPERADMIN (tanpa toko) diarahkan
// ke beranda: ia mengelola toko & pemilik, bukan bertransaksi.
export async function requireStore(permission: Permission) {
  const user = await requirePermission(permission);
  if (!user.storeId) redirect("/");
  return { ...user, storeId: user.storeId };
}

// Untuk halaman/aksi yang WAJIB login. Kalau belum login → ke /login.
// redirect() bertipe `never`, jadi setelah baris itu TypeScript tahu `user`
// pasti ada.
//
// User yang masih memakai password sementara diarahkan ke /change-password.
// Karena semua page, layout, dan Server Action lewat fungsi ini, user tidak
// bisa membuka/menjalankan apa pun sebelum mengganti password. Halaman
// /change-password sendiri memakai getCurrentUser() agar tidak redirect loop.
export async function verifySession() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

// Untuk halaman yang hanya boleh dibuka user dengan permission tertentu.
// Contoh: await requirePermission("report:view") di halaman laporan.
//
// Di Server Action, sering lebih enak memakai can() lalu mengembalikan pesan
// error (ActionResult) daripada redirect:
//
//     const user = await verifySession();
//     if (!can(user, "product:manage")) return { success: false, message: "Akses ditolak." };
export async function requirePermission(permission: Permission) {
  const user = await verifySession();
  if (!can(user, permission)) redirect("/");
  return user;
}
