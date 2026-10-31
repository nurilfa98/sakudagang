// Aturan bisnis fitur pengguna (fungsi murni, tanpa DB).
//
// Siapa boleh mengelola siapa (docs/BUSINESS-FLOW.md §2):
// - SUPERADMIN tidak pernah bisa dikelola dari aplikasi (hanya script).
// - OWNER dikelola oleh pemegang user:manage-owner (Superadmin).
// - CASHIER dikelola oleh pemegang user:manage-cashier di toko yang sama.
// - Superadmin mengelola pengguna HANYA di toko yang sedang dibukanya (toko
//   aktif), pola sama dengan ArchiPay: buka toko → menu Pengguna.
// - Siapa pun boleh MENGUBAH DATA DIRINYA SENDIRI (nama, email, WhatsApp)
//   lewat "Profile"; nonaktifkan/reset password diri sendiri tetap tidak
//   boleh (ganti password lewat /change-password).
// - Pemilik boleh MELIHAT (tanpa mengubah) Pemilik lain di tokonya.

import { can } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/dal";

// Pemeriksaan per role/toko cukup role + toko; pemeriksaan "diri sendiri" butuh id.
type Actor = Pick<CurrentUser, "role" | "storeId" | "activeStore">;
type ActorWithId = Pick<CurrentUser, "id" | "role" | "storeId" | "activeStore">;
type Target = { id: string; role: Role; storeId: string | null };

// Role yang boleh diberikan saat membuat pengguna baru.
export const ASSIGNABLE_ROLES = ["OWNER", "CASHIER"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

// Toko tempat actor mengelola pengguna: tokonya sendiri, atau toko yang
// sedang dibuka Superadmin. null = belum membuka toko (tidak boleh apa-apa).
export function managedStoreId(actor: Actor) {
  return actor.storeId ?? actor.activeStore?.id ?? null;
}

export function canManageRoleInStore(actor: Actor, role: Role, storeId: string | null) {
  if (role === "SUPERADMIN") return false;
  const scope = managedStoreId(actor);
  if (!scope || scope !== storeId) return false;
  if (role === "OWNER") return can(actor, "user:manage-owner");
  return can(actor, "user:manage-cashier");
}

// Kelola penuh: ubah data, nonaktifkan, reset password, kirim undangan.
export function canManageUser(actor: Actor, target: { role: Role; storeId: string | null }) {
  return canManageRoleInStore(actor, target.role, target.storeId);
}

// Ubah nama/email/WhatsApp: pengelola, atau diri sendiri.
export function canEditUser(actor: ActorWithId, target: Target) {
  return actor.id === target.id || canManageUser(actor, target);
}

// Membuka halaman detail: pengelola, diri sendiri, atau rekan setoko oleh
// pemegang user:manage-cashier (Pemilik melihat Pemilik lain, hanya baca).
export function canViewUser(actor: ActorWithId, target: Target) {
  if (canEditUser(actor, target)) return true;
  if (target.role === "SUPERADMIN") return false;
  const scope = managedStoreId(actor);
  return can(actor, "user:manage-cashier") && scope !== null && scope === target.storeId;
}

// Role yang boleh dipilih actor saat menambah pengguna di tokonya.
export function assignableRolesFor(actor: Actor): AssignableRole[] {
  return ASSIGNABLE_ROLES.filter((role) => canManageRoleInStore(actor, role, managedStoreId(actor)));
}

// "Email syarat login": pemilik/kasir yang tidak punya email tetap butuh email
// untuk login, jadi admin mendaftarkan email buatan dari nama depannya, misal
// nama "Nita Aulia" → nita@gmail.com. Email seperti ini dianggap tidak aktif:
// kredensial TIDAK dikirim ke sana, cukup disampaikan lewat WhatsApp.
//
// Aturan: bagian email sebelum "@" sama dengan kata pertama nama lengkap
// (tidak peka huruf besar/kecil, tanda baca diabaikan). Domain tidak dicek,
// supaya nita@yahoo.com juga dianggap sama.
export function isPlaceholderEmail(fullName: string, email: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const localPart = normalize(email.split("@")[0] ?? "");
  const firstName = normalize(fullName.trim().split(/\s+/)[0] ?? "");
  return firstName.length > 0 && localPart === firstName;
}
