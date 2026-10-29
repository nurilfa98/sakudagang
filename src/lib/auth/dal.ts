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
import { and, eq, exists, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { stores, subscriptions, users } from "@/lib/db/schema";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getStoreAccess, type StoreAccess } from "@/lib/subscription-access";
import { readActiveStoreCookie } from "./active-store";
import { can, type Permission } from "./permissions";
import { isRole, type Role } from "./roles";
import { getSession } from "./session";

// DTO (Data Transfer Object): hanya field yang aman & dibutuhkan UI.
// password_hash TIDAK ikut.
export type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  // Toko tempat user bekerja (users.store_id); null hanya untuk SUPERADMIN.
  storeId: string | null;
  // Toko yang sedang dibuka: untuk Pemilik/Kasir = tokonya sendiri, untuk
  // Superadmin = toko yang dipilih (cookie, lib/auth/active-store.ts), null
  // bila belum memilih. Semua query & action fitur bisnis WAJIB membatasi
  // data ke toko ini lewat requireStore() (multi-tenant).
  // `access` = status masa gratis/langganan (BUSINESS-FLOW §14.3): bila
  // `locked`, Pemilik hanya boleh membuka halaman Langganan (verifySession
  // mengarahkan ke sana) dan Kasir tidak bisa masuk. Superadmin tidak pernah dikunci.
  activeStore: { id: string; name: string; isActive: boolean; access: StoreAccess } | null;
};

// Subquery "toko pernah punya tagihan lunas" (label masa gratis vs langganan aktif).
const hasPaidSubscription = sql<boolean>`${exists(
  db
    .select({ one: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.storeId, stores.id), eq(subscriptions.status, "ACTIVE"))),
)}`;

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
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      sessionVersion: users.sessionVersion,
      storeId: users.storeId,
      storeName: stores.name,
      storeIsActive: stores.isActive,
      storeSubscriptionUntil: stores.subscriptionUntil,
      storeHasPaid: hasPaidSubscription,
    })
    .from(users)
    .leftJoin(stores, eq(users.storeId, stores.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.isActive) return null;
  if (user.storeId && !user.storeIsActive) return null;
  // Password sudah diganti/di-reset setelah cookie ini dibuat → login ulang.
  if (user.sessionVersion !== sessionVersion) return null;
  // Nilai role dijaga CHECK constraint; cek ulang di sini agar tipenya pasti Role.
  if (!isRole(user.role)) return null;

  // Masa tenggang dari Pengaturan; dibaca sekali per request bersama user.
  const settings = await getPlatformSettings();
  const activeStore =
    user.storeId && user.storeName != null && user.storeSubscriptionUntil
      ? {
          id: user.storeId,
          name: user.storeName,
          isActive: user.storeIsActive === true,
          access: getStoreAccess({
            subscriptionUntil: user.storeSubscriptionUntil,
            hasPaid: user.storeHasPaid === true,
            graceDays: settings.graceDays,
          }),
        }
      : user.role === "SUPERADMIN"
        ? await findSuperadminActiveStore(settings.graceDays)
        : null;

  // Kasir toko yang langganannya habis (lewat masa tenggang) tidak bisa masuk;
  // Pemilik tetap masuk tapi hanya ke halaman Langganan (verifySession).
  if (user.role === "CASHIER" && activeStore?.access.locked) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    storeId: user.storeId,
    activeStore,
  };
}

// Toko yang dipilih Superadmin (cookie), dicocokkan ke database. Toko nonaktif
// tetap boleh dibuka Superadmin (untuk mengelolanya), berbeda dengan Pemilik.
async function findSuperadminActiveStore(graceDays: number) {
  const storeId = await readActiveStoreCookie();
  if (!storeId) return null;
  const [store] = await db
    .select({
      id: stores.id,
      name: stores.name,
      isActive: stores.isActive,
      subscriptionUntil: stores.subscriptionUntil,
      hasPaid: hasPaidSubscription,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  if (!store) return null;
  return {
    id: store.id,
    name: store.name,
    isActive: store.isActive,
    access: getStoreAccess({ subscriptionUntil: store.subscriptionUntil, hasPaid: store.hasPaid, graceDays }),
  };
}

// Untuk halaman/aksi fitur bisnis yang datanya milik SATU toko. Mengembalikan
// user beserta storeId toko yang sedang dibuka (pasti terisi), sehingga query
// bisa langsung `where(eq(products.storeId, storeId))`.
// - Pemilik/Kasir: tokonya sendiri.
// - Superadmin: toko yang dipilih dari beranda; belum memilih → ke beranda.
export async function requireStore(permission: Permission, options?: { allowLocked?: boolean }) {
  const user = await requirePermission(permission, options);
  if (!user.activeStore) redirect("/");
  return { ...user, storeId: user.activeStore.id, activeStore: user.activeStore };
}

// Untuk halaman/aksi yang WAJIB login. Kalau belum login → ke /login.
// redirect() bertipe `never`, jadi setelah baris itu TypeScript tahu `user`
// pasti ada.
//
// User yang masih memakai password sementara diarahkan ke /change-password.
// Karena semua page, layout, dan Server Action lewat fungsi ini, user tidak
// bisa membuka/menjalankan apa pun sebelum mengganti password. Halaman
// /change-password sendiri memakai getCurrentUser() agar tidak redirect loop.
//
// Toko terkunci (langganan habis + masa tenggang lewat, BUSINESS-FLOW §14.3):
// Pemilik diarahkan ke /subscription. Halaman/aksi yang memang boleh dibuka
// saat terkunci (layout, halaman Langganan & action-nya) memakai
// `allowLocked: true`. Superadmin tidak pernah dikunci.
export async function verifySession({ allowLocked = false }: { allowLocked?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (!allowLocked && user.role !== "SUPERADMIN" && user.activeStore?.access.locked) redirect("/subscription");
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
export async function requirePermission(permission: Permission, options?: { allowLocked?: boolean }) {
  const user = await verifySession(options);
  if (!can(user, permission)) redirect("/");
  return user;
}
