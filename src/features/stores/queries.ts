// Query database untuk halaman Toko. Pemanggil WAJIB sudah mengecek hak akses
// (requirePermission / canEditStore) sebelum memakai fungsi di sini.
//
// Kenapa setiap fungsi diawali `await io()`?
// Driver postgres.js memanggil Math.random() saat membuka koneksi. Saat
// prerender (dev & prefetch), hasil getCurrentUser() bisa sudah ada di cache
// sehingga query di sini ikut berjalan, lalu Next.js menolak Math.random().
// io() menandai bahwa setelah baris ini ada operasi I/O: saat prerender ia
// berhenti (fallback <Suspense> yang tampil), saat request biasa langsung lanjut.
//
// Referensi:
// - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/io.md
// - https://orm.drizzle.team/docs/select#aggregations

import "server-only";
import { and, asc, count, eq, exists, inArray, isNotNull, sql } from "drizzle-orm";
import { io } from "next/cache";
import { db } from "@/lib/db";
import { products, stores, subscriptions, users } from "@/lib/db/schema";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getStoreAccess, type StoreAccess } from "@/lib/subscription-access";
import type { StoreFilters } from "./schemas";

// Batas baris per query; pencarian & halaman berjalan di browser (ARCHITECTURE.md §3).
const LIST_LIMIT = 500;

export type StoreListItem = {
  id: string;
  name: string;
  businessType: string | null;
  isActive: boolean;
  userCount: number;
  productCount: number;
  ownerNames: string[];
  createdAt: Date;
  // Status masa gratis/langganan (BUSINESS-FLOW §14), untuk kartu & tabel toko.
  access: StoreAccess;
};

// Angka ringkasan platform untuk kotak di beranda Superadmin.
export type StoreSummary = {
  totalStores: number;
  activeStores: number;
  inactiveStores: number;
  totalUsers: number; // Pemilik + Kasir semua toko (tanpa Superadmin)
  storesWithoutOwner: number;
  expiringSoon: number; // toko aktif yang masa langganannya habis ≤ 7 hari atau sedang tenggang
  lockedStores: number; // toko yang aksesnya terkunci (langganan habis)
};

export type StoreDetail = {
  id: string;
  name: string;
  businessType: string | null;
  address: string | null;
  phone: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  access: StoreAccess;
};

export type StoreOption = { id: string; name: string };

// Subquery "toko pernah punya tagihan lunas" (label masa gratis vs aktif).
const hasPaidSubscription = sql<boolean>`${exists(
  db
    .select({ one: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.storeId, stores.id), eq(subscriptions.status, "ACTIVE"))),
)}`;

// Semua toko + jumlah user & barang + nama pemilik aktif (untuk Superadmin).
// Filter status & jenis usaha diterapkan di SQL.
export async function listStores({
  status,
  businessType,
  limit = LIST_LIMIT,
}: StoreFilters & { limit?: number } = {}): Promise<StoreListItem[]> {
  await io();
  const rows = await db
    .select({
      id: stores.id,
      name: stores.name,
      businessType: stores.businessType,
      isActive: stores.isActive,
      createdAt: stores.createdAt,
      subscriptionUntil: stores.subscriptionUntil,
      hasPaid: hasPaidSubscription,
      userCount: count(users.id),
    })
    .from(stores)
    .leftJoin(users, eq(users.storeId, stores.id))
    .where(
      and(
        status ? eq(stores.isActive, status === "ACTIVE") : undefined,
        businessType ? eq(stores.businessType, businessType) : undefined,
      ),
    )
    .groupBy(stores.id)
    .orderBy(asc(stores.name))
    .limit(limit);

  const storeIds = rows.map((row) => row.id);
  const [owners, productCounts, settings] = await Promise.all([
    getOwnerNamesByStoreIds(storeIds),
    getProductCountsByStoreIds(storeIds),
    getPlatformSettings(),
  ]);
  return rows.map(({ subscriptionUntil, hasPaid, ...row }) => ({
    ...row,
    ownerNames: owners.get(row.id) ?? [],
    productCount: productCounts.get(row.id) ?? 0,
    access: getStoreAccess({ subscriptionUntil, hasPaid, graceDays: settings.graceDays }),
  }));
}

// Ringkasan untuk kotak-kotak di beranda Superadmin; dihitung dari daftar
// yang sudah diambil agar tidak ada query tambahan.
export function summarizeStores(list: StoreListItem[]): StoreSummary {
  const activeStores = list.filter((store) => store.isActive).length;
  return {
    totalStores: list.length,
    activeStores,
    inactiveStores: list.length - activeStores,
    totalUsers: list.reduce((sum, store) => sum + store.userCount, 0),
    storesWithoutOwner: list.filter((store) => store.ownerNames.length === 0).length,
    expiringSoon: list.filter((store) => store.isActive && store.access.needsReminder).length,
    lockedStores: list.filter((store) => store.isActive && store.access.locked).length,
  };
}

// Jenis usaha yang pernah diisi, untuk pilihan filter di daftar toko.
export async function listBusinessTypes(): Promise<string[]> {
  await io();
  const rows = await db
    .selectDistinct({ businessType: stores.businessType })
    .from(stores)
    .where(isNotNull(stores.businessType))
    .orderBy(asc(stores.businessType));
  return rows.flatMap((row) => (row.businessType ? [row.businessType] : []));
}

// Pilihan toko untuk form tambah pengguna (hanya toko aktif).
export async function listStoreOptions(): Promise<StoreOption[]> {
  await io();
  return db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(eq(stores.isActive, true))
    .orderBy(asc(stores.name));
}

export async function getStore(id: string): Promise<StoreDetail | null> {
  await io();
  const [[row], settings] = await Promise.all([
    db
      .select({
        id: stores.id,
        name: stores.name,
        businessType: stores.businessType,
        address: stores.address,
        phone: stores.phone,
        timezone: stores.timezone,
        isActive: stores.isActive,
        createdAt: stores.createdAt,
        subscriptionUntil: stores.subscriptionUntil,
        hasPaid: hasPaidSubscription,
      })
      .from(stores)
      .where(eq(stores.id, id))
      .limit(1),
    getPlatformSettings(),
  ]);
  if (!row) return null;
  const { subscriptionUntil, hasPaid, ...store } = row;
  return { ...store, access: getStoreAccess({ subscriptionUntil, hasPaid, graceDays: settings.graceDays }) };
}

// Jumlah barang aktif per toko, satu query untuk semua toko.
async function getProductCountsByStoreIds(storeIds: string[]) {
  const result = new Map<string, number>();
  if (storeIds.length === 0) return result;

  const rows = await db
    .select({ storeId: products.storeId, total: count(products.id) })
    .from(products)
    .where(and(inArray(products.storeId, storeIds), eq(products.isActive, true)))
    .groupBy(products.storeId);

  for (const row of rows) result.set(row.storeId, row.total);
  return result;
}

// Satu query untuk pemilik SEMUA toko di daftar (menghindari N+1).
async function getOwnerNamesByStoreIds(storeIds: string[]) {
  const result = new Map<string, string[]>();
  if (storeIds.length === 0) return result;

  const rows = await db
    .select({ storeId: users.storeId, fullName: users.fullName })
    .from(users)
    .where(and(inArray(users.storeId, storeIds), eq(users.role, "OWNER"), eq(users.isActive, true)))
    .orderBy(asc(users.fullName));

  for (const row of rows) {
    if (!row.storeId) continue;
    result.set(row.storeId, [...(result.get(row.storeId) ?? []), row.fullName]);
  }
  return result;
}
