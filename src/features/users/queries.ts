// Query database untuk halaman Pengguna. Hasilnya berupa DTO tanpa
// password_hash, aman dikirim ke komponen.
//
// Akun SUPERADMIN SELALU dikecualikan di sini (docs/BUSINESS-FLOW.md §2):
// tidak ada halaman yang bisa melihat atau mengubahnya.
//
// Pemanggil WAJIB sudah mengecek hak akses (requirePermission + canManageUser)
// sebelum memakai fungsi di sini. Penjelasan `await io()` ada di
// features/stores/queries.ts.
//
// Referensi: node_modules/next/dist/docs/01-app/02-guides/data-security.md

import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { io } from "next/cache";
import { isRole, type Role } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { stores, users } from "@/lib/db/schema";
import type { UserFilters } from "./schemas";

// Batas baris per query; pencarian & halaman berjalan di browser (ARCHITECTURE.md §3).
const LIST_LIMIT = 500;

export type UserListItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  storeId: string | null;
  storeName: string | null;
};

export type UserDetail = UserListItem;

const listColumns = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  phone: users.phone,
  role: users.role,
  isActive: users.isActive,
  mustChangePassword: users.mustChangePassword,
  storeId: users.storeId,
  storeName: stores.name,
};

// Superadmin tidak pernah ikut.
const notSuperadmin = ne(users.role, "SUPERADMIN");

// Daftar pengguna satu toko (Pemilik; storeId wajib) atau lintas toko
// (Superadmin; storeId kosong = semua toko). Filter role & status di SQL.
export async function listUsers({
  storeId,
  role,
  status,
  limit = LIST_LIMIT,
}: UserFilters & { limit?: number }): Promise<UserListItem[]> {
  await io();
  const rows = await db
    .select(listColumns)
    .from(users)
    .leftJoin(stores, eq(users.storeId, stores.id))
    .where(
      and(
        notSuperadmin,
        storeId ? eq(users.storeId, storeId) : undefined,
        role ? eq(users.role, role) : undefined,
        status === "INACTIVE" ? eq(users.isActive, false) : undefined,
        status === "ACTIVE" ? and(eq(users.isActive, true), eq(users.mustChangePassword, false)) : undefined,
        status === "PENDING" ? and(eq(users.isActive, true), eq(users.mustChangePassword, true)) : undefined,
      ),
    )
    .orderBy(asc(stores.name), asc(users.fullName))
    .limit(limit);

  return rows.flatMap((row) => (isRole(row.role) ? [{ ...row, role: row.role }] : []));
}

// null bila tidak ada ATAU bila targetnya SUPERADMIN (tersembunyi).
export async function getUserDetail(id: string): Promise<UserDetail | null> {
  await io();
  const [row] = await db
    .select(listColumns)
    .from(users)
    .leftJoin(stores, eq(users.storeId, stores.id))
    .where(and(eq(users.id, id), notSuperadmin))
    .limit(1);

  if (!row || !isRole(row.role)) return null;
  return { ...row, role: row.role };
}
