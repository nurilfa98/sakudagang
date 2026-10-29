// Query database fitur langganan. Pemanggil WAJIB sudah mengecek hak akses.
// Penjelasan `await io()` ada di features/stores/queries.ts.
//
// Tanggal diformat di server (lib/dates.ts khusus server) dan dikirim sebagai
// teks + angka (untuk mengurutkan) ke data table.

import "server-only";
import { and, asc, count, desc, eq, exists, gte, lt, sql } from "drizzle-orm";
import { io } from "next/cache";
import { formatDate, formatDateTime, zonedPeriodRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { stores, storePlanPrices, subscriptionPlans, subscriptions, users } from "@/lib/db/schema";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getStoreAccess, type StoreAccess } from "@/lib/subscription-access";
import { PLAN_MONTHS, type PlanMonths, type SubscriptionStatus } from "./constants";
import type { SubscriptionFilters } from "./schemas";

// Batas baris per query; pencarian & halaman berjalan di browser (ARCHITECTURE.md §3).
const LIST_LIMIT = 500;

export type PlanPrice = {
  months: PlanMonths;
  price: number; // harga total periode; 0 = belum diatur
  standardPrice: number; // harga standar (untuk menampilkan "harga khusus")
  custom: boolean; // true bila memakai harga khusus toko
  note: string | null; // catatan harga khusus
};

export type SubscriptionItem = {
  id: string;
  storeId: string;
  storeName: string;
  months: PlanMonths;
  price: number;
  status: SubscriptionStatus;
  note: string | null;
  createdAtLabel: string;
  createdAtTime: number;
  periodLabel: string | null; // "1 Nov 2026 – 1 Des 2026" bila sudah lunas
  paidAtLabel: string | null;
  createdByName: string;
};

export type StoreSubscriptionState = {
  access: StoreAccess;
  pending: SubscriptionItem | null; // tagihan yang menunggu bayar (maks. satu)
};

// Harga standar semua paket, urut 1/6/12 bulan.
export async function listPlans(): Promise<{ months: PlanMonths; price: number }[]> {
  await io();
  const rows = await db.select({ months: subscriptionPlans.months, price: subscriptionPlans.price }).from(subscriptionPlans);
  return PLAN_MONTHS.map((months) => ({ months, price: rows.find((row) => row.months === months)?.price ?? 0 }));
}

// Harga yang berlaku untuk satu toko: harga khusus bila ada, selain itu standar.
export async function listPlansForStore(storeId: string): Promise<PlanPrice[]> {
  const [plans, custom] = await Promise.all([listPlans(), getStorePlanPrices(storeId)]);
  return plans.map((plan) => {
    const override = custom.find((row) => row.months === plan.months);
    return {
      months: plan.months,
      price: override?.price ?? plan.price,
      standardPrice: plan.price,
      custom: override != null,
      note: override?.note ?? null,
    };
  });
}

export async function getStorePlanPrices(storeId: string) {
  await io();
  const rows = await db
    .select({ months: storePlanPrices.months, price: storePlanPrices.price, note: storePlanPrices.note })
    .from(storePlanPrices)
    .where(eq(storePlanPrices.storeId, storeId));
  return rows.flatMap((row) =>
    (PLAN_MONTHS as readonly number[]).includes(row.months) ? [{ ...row, months: row.months as PlanMonths }] : [],
  );
}

// Toko yang punya harga khusus, untuk tabel di halaman Pengaturan.
export type StorePriceRow = {
  storeId: string;
  storeName: string;
  price1: number | null;
  price6: number | null;
  price12: number | null;
  note: string | null;
};

export async function listStorePriceOverrides(): Promise<StorePriceRow[]> {
  await io();
  const rows = await db
    .select({
      storeId: storePlanPrices.storeId,
      storeName: stores.name,
      months: storePlanPrices.months,
      price: storePlanPrices.price,
      note: storePlanPrices.note,
    })
    .from(storePlanPrices)
    .innerJoin(stores, eq(storePlanPrices.storeId, stores.id))
    .orderBy(asc(stores.name));

  const byStore = new Map<string, StorePriceRow>();
  for (const row of rows) {
    const entry = byStore.get(row.storeId) ?? {
      storeId: row.storeId,
      storeName: row.storeName,
      price1: null,
      price6: null,
      price12: null,
      note: null,
    };
    if (row.months === 1) entry.price1 = row.price;
    if (row.months === 6) entry.price6 = row.price;
    if (row.months === 12) entry.price12 = row.price;
    entry.note = entry.note ?? row.note;
    byStore.set(row.storeId, entry);
  }
  return [...byStore.values()];
}

// Status akses + tagihan menunggu satu toko (halaman Langganan, detail toko).
export async function getStoreSubscriptionState(storeId: string): Promise<StoreSubscriptionState | null> {
  await io();
  const [[store], settings, pendingRows] = await Promise.all([
    db
      .select({ subscriptionUntil: stores.subscriptionUntil, hasPaid: hasPaidSubscription() })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1),
    getPlatformSettings(),
    listSubscriptions({ storeId, status: "PENDING", limit: 1 }),
  ]);
  if (!store) return null;
  return {
    access: getStoreAccess({
      subscriptionUntil: store.subscriptionUntil,
      hasPaid: store.hasPaid,
      graceDays: settings.graceDays,
    }),
    pending: pendingRows[0] ?? null,
  };
}

// Subquery "toko ini pernah punya tagihan lunas", untuk membedakan masa
// gratis vs langganan aktif. Dipakai juga features/stores/queries.ts.
export function hasPaidSubscription() {
  return sql<boolean>`${exists(
    db
      .select({ one: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.storeId, stores.id), eq(subscriptions.status, "ACTIVE"))),
  )}`;
}

// Daftar tagihan: satu toko (Pemilik) atau semua toko (Superadmin, storeId kosong).
export async function listSubscriptions({
  storeId,
  status,
  year,
  limit = LIST_LIMIT,
}: SubscriptionFilters & { limit?: number }): Promise<SubscriptionItem[]> {
  await io();
  const period = year ? zonedPeriodRange(year) : null;
  const rows = await db
    .select({
      id: subscriptions.id,
      storeId: subscriptions.storeId,
      storeName: stores.name,
      months: subscriptions.months,
      price: subscriptions.price,
      status: subscriptions.status,
      note: subscriptions.note,
      startsAt: subscriptions.startsAt,
      endsAt: subscriptions.endsAt,
      paidAt: subscriptions.paidAt,
      createdAt: subscriptions.createdAt,
      createdByName: users.fullName,
    })
    .from(subscriptions)
    .innerJoin(stores, eq(subscriptions.storeId, stores.id))
    .innerJoin(users, eq(subscriptions.createdById, users.id))
    .where(
      and(
        storeId ? eq(subscriptions.storeId, storeId) : undefined,
        status ? eq(subscriptions.status, status) : undefined,
        period ? gte(subscriptions.createdAt, period.start) : undefined,
        period ? lt(subscriptions.createdAt, period.end) : undefined,
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit);

  return rows.map(({ startsAt, endsAt, paidAt, createdAt, ...row }) => ({
    ...row,
    months: row.months as PlanMonths,
    status: row.status as SubscriptionStatus,
    createdAtLabel: formatDateTime(createdAt),
    createdAtTime: createdAt.getTime(),
    periodLabel: startsAt && endsAt ? `${formatDate(startsAt)} – ${formatDate(endsAt)}` : null,
    paidAtLabel: paidAt ? formatDateTime(paidAt) : null,
  }));
}

// Jumlah tagihan menunggu konfirmasi (kotak di beranda Superadmin).
export async function countPendingSubscriptions() {
  await io();
  const [row] = await db
    .select({ total: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, "PENDING"));
  return row?.total ?? 0;
}

// Tahun yang punya tagihan, untuk pilihan filter.
export async function listSubscriptionYears(storeId?: string) {
  await io();
  const rows = await db
    .select({ createdAt: subscriptions.createdAt })
    .from(subscriptions)
    .where(storeId ? eq(subscriptions.storeId, storeId) : undefined);
  return [...new Set(rows.map((row) => row.createdAt.getFullYear()))].sort((a, b) => b - a);
}
