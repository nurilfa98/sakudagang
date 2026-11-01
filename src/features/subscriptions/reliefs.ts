// Penilaian perlindungan bulan sepi (BUSINESS-FLOW §14.8), dijalankan cron
// harian app/api/cron/subscription-reminders/route.ts. Aturannya ada di
// relief.ts (fungsi murni).
//
// Setiap kali berjalan, yang dinilai adalah BULAN KALENDER SEBELUMNYA (zona
// waktu aplikasi), untuk toko yang punya paket 6/12 bulan lunas dengan
// perlindungan dan masa paketnya mencakup penuh bulan itu. Cron pertama di
// awal bulan yang melakukannya; berikutnya dilewati karena unique index
// (store_id, period_year, period_month), sehingga cron yang terlewat sehari
// tetap menyusul dan cron yang berjalan dua kali tidak memberi dobel.
//
// Hasil penilaian disimpan (subscription_reliefs) apa adanya dan tidak
// dihitung ulang walau transaksi lama kemudian berubah.

import "server-only";
import { and, count, eq, gte, inArray, isNotNull, lt, lte, notExists, sql } from "drizzle-orm";
import { formatMonthYear, zonedPeriodRange, zonedYearMonth } from "@/lib/dates";
import { db } from "@/lib/db";
import { sales, stores, subscriptionReliefs, subscriptions } from "@/lib/db/schema";
import { addDays } from "@/lib/subscription-access";
import { notifyOwnersOfRelief } from "./notifications";
import { firstDayOf, judgeMonth, RELIEF_BASELINE_MONTHS, shiftMonth } from "./relief";
import type { ReliefStatus } from "./constants";

export type ReliefResult = {
  storeId: string;
  storeName: string;
  period: string; // "2026-10"
  status: ReliefStatus;
  dropPercent: number | null;
  days: number;
};

export async function evaluateSlowMonthReliefs(now = new Date()): Promise<ReliefResult[]> {
  const current = zonedYearMonth(now);
  const target = shiftMonth(current.year, current.month, -1);
  const range = zonedPeriodRange(target.year, target.month);

  // Paket lunas dengan perlindungan yang mencakup penuh bulan target, dan
  // tokonya belum dinilai untuk bulan itu.
  const candidates = await db
    .select({
      subscriptionId: subscriptions.id,
      storeId: subscriptions.storeId,
      storeName: stores.name,
      storeCreatedAt: stores.createdAt,
      reliefDays: subscriptions.reliefDays,
      reliefDropPercent: subscriptions.reliefDropPercent,
      reliefMax: subscriptions.reliefMax,
    })
    .from(subscriptions)
    .innerJoin(stores, eq(subscriptions.storeId, stores.id))
    .where(
      and(
        eq(subscriptions.status, "ACTIVE"),
        isNotNull(subscriptions.reliefDays),
        isNotNull(subscriptions.reliefDropPercent),
        isNotNull(subscriptions.reliefMax),
        lte(subscriptions.startsAt, range.start),
        gte(subscriptions.endsAt, range.end),
        eq(stores.isActive, true),
        notExists(
          db
            .select({ one: subscriptionReliefs.id })
            .from(subscriptionReliefs)
            .where(
              and(
                eq(subscriptionReliefs.storeId, stores.id),
                eq(subscriptionReliefs.periodYear, target.year),
                eq(subscriptionReliefs.periodMonth, target.month),
              ),
            ),
        ),
      ),
    );
  // Masa paket satu toko tidak tumpang-tindih; jaga-jaga, satu paket per toko.
  const byStore = new Map(candidates.map((row) => [row.storeId, row]));
  if (byStore.size === 0) return [];

  // Omzet per toko per bulan: bulan target + 3 bulan sebelumnya. Omzet =
  // Σ penjualan COMPLETED menurut tanggal transaksi (bon ikut dihitung saat
  // terjadi, penjualan dibatalkan tidak), sama dengan laporan.
  const months = Array.from({ length: RELIEF_BASELINE_MONTHS + 1 }, (_, i) =>
    shiftMonth(target.year, target.month, -RELIEF_BASELINE_MONTHS + i),
  );
  const next = shiftMonth(target.year, target.month, 1);
  const monthKey = sql<string>`to_char(${sales.date}, 'YYYY-MM')`;
  const revenueRows = await db
    .select({
      storeId: sales.storeId,
      key: monthKey,
      revenue: sql<number>`coalesce(sum(${sales.total}), 0)`.mapWith(Number),
    })
    .from(sales)
    .where(
      and(
        inArray(sales.storeId, [...byStore.keys()]),
        eq(sales.status, "COMPLETED"),
        gte(sales.date, firstDayOf(months[0].year, months[0].month)),
        lt(sales.date, firstDayOf(next.year, next.month)),
      ),
    )
    .groupBy(sales.storeId, monthKey);
  const revenueOf = (storeId: string, year: number, month: number) =>
    revenueRows.find((row) => row.storeId === storeId && row.key === firstDayOf(year, month).slice(0, 7))?.revenue ?? 0;

  const monthLabel = formatMonthYear(target.year, target.month);
  const period = firstDayOf(target.year, target.month).slice(0, 7);
  const results: ReliefResult[] = [];

  for (const candidate of byStore.values()) {
    const days = candidate.reliefDays!;
    const max = candidate.reliefMax!;
    const revenue = revenueOf(candidate.storeId, target.year, target.month);
    // Bulan pembanding hanya dihitung bila toko sudah ada sejak awal bulan itu.
    const previous = months.slice(0, RELIEF_BASELINE_MONTHS).map(({ year, month }) =>
      candidate.storeCreatedAt <= zonedPeriodRange(year, month).start ? revenueOf(candidate.storeId, year, month) : null,
    );
    const verdict = judgeMonth(revenue, previous, candidate.reliefDropPercent!);

    const outcome = await db.transaction(async (tx) => {
      // Kunci baris toko: perpanjangan & pembatalan tidak saling menimpa.
      const [store] = await tx
        .select({ subscriptionUntil: stores.subscriptionUntil })
        .from(stores)
        .where(eq(stores.id, candidate.storeId))
        .for("update");
      if (!store) return null;

      let status: ReliefStatus = verdict.status;
      let used = 0;
      if (status === "GRANTED") {
        const [row] = await tx
          .select({ total: count() })
          .from(subscriptionReliefs)
          .where(and(eq(subscriptionReliefs.subscriptionId, candidate.subscriptionId), eq(subscriptionReliefs.status, "GRANTED")));
        used = row?.total ?? 0;
        if (used >= max) status = "QUOTA_USED";
      }
      const granted = status === "GRANTED";
      const untilAfter = granted ? addDays(store.subscriptionUntil, days) : null;

      const [inserted] = await tx
        .insert(subscriptionReliefs)
        .values({
          storeId: candidate.storeId,
          subscriptionId: candidate.subscriptionId,
          periodYear: target.year,
          periodMonth: target.month,
          revenue,
          baselineRevenue: verdict.baseline,
          dropPercent: verdict.dropPercent,
          status,
          days: granted ? days : 0,
          untilAfter,
        })
        .onConflictDoNothing()
        .returning({ id: subscriptionReliefs.id });
      // Sudah dinilai proses lain (cron berjalan bersamaan).
      if (!inserted) return null;

      if (untilAfter) await tx.update(stores).set({ subscriptionUntil: untilAfter }).where(eq(stores.id, candidate.storeId));
      return { status, untilAfter, remaining: max - used - 1 };
    });
    if (!outcome) continue;

    if (outcome.untilAfter && verdict.dropPercent != null) {
      // Gagal kirim tidak membatalkan perpanjangan (sendWhatsApp tidak melempar).
      await notifyOwnersOfRelief(candidate.storeId, {
        kind: "granted",
        monthLabel,
        dropPercent: verdict.dropPercent,
        days,
        until: outcome.untilAfter,
        remaining: outcome.remaining,
      });
    }
    results.push({
      storeId: candidate.storeId,
      storeName: candidate.storeName,
      period,
      status: outcome.status,
      dropPercent: verdict.dropPercent,
      days: outcome.untilAfter ? days : 0,
    });
  }
  return results;
}
