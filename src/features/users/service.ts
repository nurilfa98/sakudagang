// Aturan bisnis fitur pengguna (fungsi murni, tanpa DB).
//
// Siapa boleh mengelola siapa (docs/BUSINESS-FLOW.md §2):
// - SUPERADMIN tidak pernah bisa dikelola dari aplikasi (hanya script).
// - OWNER dikelola oleh pemegang user:manage-owner (Superadmin).
// - CASHIER dikelola oleh pemegang user:manage-cashier di toko yang sama;
//   Superadmin (tanpa toko) boleh untuk toko mana pun.

import { can } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/dal";

type Actor = Pick<CurrentUser, "role" | "storeId">;

// Role yang boleh diberikan saat membuat pengguna baru.
export const ASSIGNABLE_ROLES = ["OWNER", "CASHIER"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function canManageRoleInStore(actor: Actor, role: Role, storeId: string | null) {
  if (role === "SUPERADMIN") return false;
  if (role === "OWNER") return can(actor, "user:manage-owner");
  if (!can(actor, "user:manage-cashier")) return false;
  return actor.storeId === null || actor.storeId === storeId;
}

export function canManageUser(actor: Actor, target: { role: Role; storeId: string | null }) {
  return canManageRoleInStore(actor, target.role, target.storeId);
}

// Role yang boleh dipilih actor saat menambah pengguna.
export function assignableRolesFor(actor: Actor): AssignableRole[] {
  return ASSIGNABLE_ROLES.filter((role) => canManageRoleInStore(actor, role, actor.storeId));
}

// "Email syarat login": pemilik/kasir yang tidak punya email tetap butuh email
// untuk login, jadi admin mendaftarkan email buatan dari nama depannya, misal
// nama "Nizam Alifa" → nizam@gmail.com. Email seperti ini dianggap tidak aktif:
// kredensial TIDAK dikirim ke sana, cukup disampaikan lewat WhatsApp.
//
// Aturan: bagian email sebelum "@" sama dengan kata pertama nama lengkap
// (tidak peka huruf besar/kecil, tanda baca diabaikan). Domain tidak dicek,
// supaya nizam@yahoo.com juga dianggap sama.
export function isPlaceholderEmail(fullName: string, email: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const localPart = normalize(email.split("@")[0] ?? "");
  const firstName = normalize(fullName.trim().split(/\s+/)[0] ?? "");
  return firstName.length > 0 && localPart === firstName;
}
