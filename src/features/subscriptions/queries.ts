// Query database fitur langganan. Pemanggil WAJIB sudah mengecek hak akses.
// Penjelasan `await io()` ada di features/stores/queries.ts.
//
// Tanggal diformat di server (lib/dates.ts khusus server) dan dikirim sebagai
// teks + angka (untuk mengurutkan) ke data table.

import "server-only";
import { and, asc, count, desc, eq, exists, gte, inArray, lt, sql } from "drizzle-orm";
import { io } from "next/cache";
import { formatDateTime, formatShortDate, zonedPeriodRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { stores, storePlanPrices, subscriptionPayments, subscriptionPlans, subscriptions } from "@/lib/db/schema";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getStoreAccess, type StoreAccess } from "@/lib/subscription-access";
import {
  OPEN_SUBSCRIPTION_STATUSES,
  PLAN_MONTHS,
  type PaymentStatus,
  type PlanMonths,
  type SubscriptionStatus,
} from "./constants";
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

// Satu pembayaran (bukti transfer) di bawah sebuah tagihan.
export type PaymentItem = {
  id: string;
  status: PaymentStatus;
  proofType: "image" | "pdf" | null; // bukti di /api/payments/[id]/proof
  note: string | null; // catatan pemilik
  amountReceived: number | null; // diisi admin saat diterima
  reviewNote: string | null; // keterangan admin / alasan tolak
  createdAtLabel: string;
  reviewedAtLabel: string | null;
};

export type SubscriptionItem = {
  id: string;
  storeId: string;
  storeName: string;
  months: PlanMonths;
  price: number;
  amountPaid: number; // Σ pembayaran diterima
  status: SubscriptionStatus;
  note: string | null;
  createdAtLabel: string;
  createdAtTime: number;
  periodLabel: string | null; // "1 Nov 2026 – 1 Des 2026" bila sudah lunas
  paidAtLabel: string | null;
  rejectedAtLabel: string | null;
  rejectionNote: string | null;
  // Pembayaran yang sedang menunggu konfirmasi admin (bila status CLAIMED).
  pendingPayment: PaymentItem | null;
};

export type StoreSubscriptionState = {
  access: StoreAccess;
  // Tagihan terbuka (menunggu konfirmasi / kurang bayar); maksimal satu per toko.
  open: SubscriptionItem | null;
  // Penolakan terakhir, bila itu kejadian paling baru (belum ada klaim/lunas
  // sesudahnya): ditampilkan sebagai pemberitahuan di halaman Langganan.
  lastRejected: SubscriptionItem | null;
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

// Status akses + tagihan terbuka satu toko (halaman Langganan, detail toko).
export async function getStoreSubscriptionState(storeId: string): Promise<StoreSubscriptionState | null> {
  await io();
  const [[store], settings, openRows, [latest]] = await Promise.all([
    db
      .select({ subscriptionUntil: stores.subscriptionUntil, hasPaid: hasPaidSubscription() })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1),
    getPlatformSettings(),
    listOpenSubscriptions(storeId),
    listSubscriptions({ storeId, limit: 1 }),
  ]);
  if (!store) return null;
  return {
    access: getStoreAccess({
      subscriptionUntil: store.subscriptionUntil,
      hasPaid: store.hasPaid,
      graceDays: settings.graceDays,
    }),
    open: openRows[0] ?? null,
    lastRejected: latest?.status === "REJECTED" ? latest : null,
  };
}

// Tagihan terbuka satu toko; seharusnya maksimal satu.
export async function listOpenSubscriptions(storeId: string) {
  await io();
  const rows = await selectSubscriptions()
    .where(and(eq(subscriptions.storeId, storeId), inArray(subscriptions.status, [...OPEN_SUBSCRIPTION_STATUSES])))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return attachPendingPayments(rows);
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
  const rows = await selectSubscriptions()
    .where(
      and(
        storeId ? eq(subscriptions.storeId, storeId) : undefined,
        status ? eq(subscriptions.status, status) : undefined,
        period ? gte(subscriptions.createdAt, period.start) : undefined,
        period ? lt(subscriptions.createdAt, period.end) : undefined,
      ),
    )
    // Yang perlu tindakan admin (menunggu konfirmasi) di atas, lalu kurang
    // bayar, lalu terbaru dulu.
    .orderBy(
      sql`CASE ${subscriptions.status} WHEN 'CLAIMED' THEN 0 WHEN 'PENDING' THEN 0 WHEN 'UNDERPAID' THEN 1 ELSE 2 END`,
      desc(subscriptions.createdAt),
    )
    .limit(limit);
  return attachPendingPayments(rows);
}

function selectSubscriptions() {
  return db
    .select({
      id: subscriptions.id,
      storeId: subscriptions.storeId,
      storeName: stores.name,
      months: subscriptions.months,
      price: subscriptions.price,
      amountPaid: subscriptions.amountPaid,
      status: subscriptions.status,
      note: subscriptions.note,
      startsAt: subscriptions.startsAt,
      endsAt: subscriptions.endsAt,
      paidAt: subscriptions.paidAt,
      rejectedAt: subscriptions.rejectedAt,
      rejectionNote: subscriptions.rejectionNote,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .innerJoin(stores, eq(subscriptions.storeId, stores.id));
}

type SubscriptionRow = Awaited<ReturnType<ReturnType<typeof selectSubscriptions>["execute"]>>[number];

// Pembayaran yang menunggu konfirmasi ditempelkan ke tagihan terbuka
// (satu query untuk semua baris, menghindari N+1).
async function attachPendingPayments(rows: SubscriptionRow[]): Promise<SubscriptionItem[]> {
  const openIds = rows
    .filter((row) => (OPEN_SUBSCRIPTION_STATUSES as readonly string[]).includes(row.status))
    .map((row) => row.id);
  const pending = new Map<string, PaymentItem>();
  if (openIds.length > 0) {
    const payments = await db
      .select(paymentColumns)
      .from(subscriptionPayments)
      .where(and(inArray(subscriptionPayments.subscriptionId, openIds), eq(subscriptionPayments.status, "PENDING")))
      .orderBy(desc(subscriptionPayments.createdAt));
    for (const payment of payments) {
      if (!pending.has(payment.subscriptionId)) pending.set(payment.subscriptionId, toPaymentItem(payment));
    }
  }

  return rows.map(({ startsAt, endsAt, paidAt, rejectedAt, createdAt, ...row }) => ({
    ...row,
    months: row.months as PlanMonths,
    status: row.status as SubscriptionStatus,
    createdAtLabel: formatDateTime(createdAt),
    createdAtTime: createdAt.getTime(),
    // Format singkat tanpa nama hari: "12 Nov 2026 - 12 Des 2026".
    periodLabel: startsAt && endsAt ? `${formatShortDate(startsAt)} - ${formatShortDate(endsAt)}` : null,
    paidAtLabel: paidAt ? formatDateTime(paidAt) : null,
    rejectedAtLabel: rejectedAt ? formatDateTime(rejectedAt) : null,
    pendingPayment: pending.get(row.id) ?? null,
  }));
}

const paymentColumns = {
  id: subscriptionPayments.id,
  subscriptionId: subscriptionPayments.subscriptionId,
  status: subscriptionPayments.status,
  proofKey: subscriptionPayments.proofKey,
  note: subscriptionPayments.note,
  amountReceived: subscriptionPayments.amountReceived,
  reviewNote: subscriptionPayments.reviewNote,
  reviewedAt: subscriptionPayments.reviewedAt,
  createdAt: subscriptionPayments.createdAt,
};

type PaymentRow = {
  id: string;
  status: string;
  proofKey: string | null;
  note: string | null;
  amountReceived: number | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

function toPaymentItem(row: PaymentRow): PaymentItem {
  return {
    id: row.id,
    status: row.status as PaymentStatus,
    proofType: row.proofKey == null ? null : row.proofKey.endsWith(".pdf") ? "pdf" : "image",
    note: row.note,
    amountReceived: row.amountReceived,
    reviewNote: row.reviewNote,
    createdAtLabel: formatDateTime(row.createdAt),
    reviewedAtLabel: row.reviewedAt ? formatDateTime(row.reviewedAt) : null,
  };
}

// Semua pembayaran satu tagihan, urut lama → baru (riwayat cicilan di kartu pemilik).
export async function listPayments(subscriptionId: string): Promise<PaymentItem[]> {
  await io();
  const rows = await db
    .select(paymentColumns)
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.subscriptionId, subscriptionId))
    .orderBy(asc(subscriptionPayments.createdAt));
  return rows.map(toPaymentItem);
}

// Jumlah tagihan yang menunggu konfirmasi admin (kotak di beranda Superadmin).
export async function countPendingSubscriptions() {
  await io();
  const [row] = await db
    .select({ total: count() })
    .from(subscriptions)
    .where(inArray(subscriptions.status, ["CLAIMED", "PENDING"]));
  return row?.total ?? 0;
}

// Key bukti transfer + toko pemilik, untuk route /api/payments/[id]/proof.
export async function getPaymentProof(id: string) {
  const [row] = await db
    .select({ storeId: subscriptionPayments.storeId, proofKey: subscriptionPayments.proofKey })
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.id, id))
    .limit(1);
  return row ?? null;
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
