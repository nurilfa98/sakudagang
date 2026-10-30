// Rumus laporan (fungsi murni, tanpa DB) — BUSINESS-FLOW §10.1.
//
// Penjualan & pembelian yang dibatalkan, serta pelunasan yang dibatalkan,
// sudah disaring di query; fungsi di sini hanya menyusun angkanya.
//
//   Omset        = Σ subtotal penjualan (semua metode, termasuk bon)
//   HPP          = Σ harga modal × qty terjual      ← uang modal yang harus diputar
//   Laba kotor   = Omset − HPP
//   Laba bersih  = Laba kotor − Pengeluaran − Penyusutan   ← uang laba
//   Uang masuk   = penjualan tunai + QRIS + pelunasan bon (tanggal pelunasan)
//   Uang keluar  = total pembelian + pengeluaran
//   Bon baru     = Σ penjualan bon dalam periode

export type PeriodTotals = {
  omset: number;
  hpp: number;
  transactionCount: number;
  cashSales: number;
  qrisSales: number;
  creditSales: number;
  creditPaymentsCash: number;
  creditPaymentsQris: number;
  expenses: number;
  shrinkage: number;
  purchases: number;
};

export type PeriodSummary = PeriodTotals & {
  grossProfit: number;
  netProfit: number;
  creditPayments: number;
  cashIn: number;
  cashOut: number;
  newCredit: number;
  averageTransaction: number;
};

export function summarizePeriod(totals: PeriodTotals): PeriodSummary {
  const grossProfit = totals.omset - totals.hpp;
  const creditPayments = totals.creditPaymentsCash + totals.creditPaymentsQris;
  return {
    ...totals,
    grossProfit,
    netProfit: grossProfit - totals.expenses - totals.shrinkage,
    creditPayments,
    cashIn: totals.cashSales + totals.qrisSales + creditPayments,
    cashOut: totals.purchases + totals.expenses,
    newCredit: totals.creditSales,
    averageTransaction: totals.transactionCount > 0 ? Math.round(totals.omset / totals.transactionCount) : 0,
  };
}

// Satu baris rincian per hari/bulan (tabel laporan bulanan/tahunan & grafik).
export type BreakdownRow = {
  key: string; // "2026-10-24" (harian) atau "2026-10" (bulanan)
  omset: number;
  hpp: number;
  grossProfit: number;
  expenses: number;
  shrinkage: number;
  netProfit: number;
};

// Menggabungkan angka per kunci dari beberapa sumber, lalu mengisi semua
// kunci periode (hari tanpa transaksi tetap tampil dengan nol).
export function buildBreakdown(
  keys: string[],
  sources: {
    sales: { key: string; omset: number; hpp: number }[];
    expenses: { key: string; amount: number }[];
    shrinkage: { key: string; amount: number }[];
  },
): BreakdownRow[] {
  const sales = new Map(sources.sales.map((row) => [row.key, row]));
  const expenses = new Map(sources.expenses.map((row) => [row.key, row.amount]));
  const shrinkage = new Map(sources.shrinkage.map((row) => [row.key, row.amount]));

  return keys.map((key) => {
    const omset = sales.get(key)?.omset ?? 0;
    const hpp = sales.get(key)?.hpp ?? 0;
    const expense = expenses.get(key) ?? 0;
    const shrink = shrinkage.get(key) ?? 0;
    return {
      key,
      omset,
      hpp,
      grossProfit: omset - hpp,
      expenses: expense,
      shrinkage: shrink,
      netProfit: omset - hpp - expense - shrink,
    };
  });
}

// "2026-10-01" … "2026-10-31": semua tanggal satu bulan.
export function daysOfMonth(year: number, month: number) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return Array.from({ length: days }, (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`);
}

// "2026-01" … "2026-12": semua bulan satu tahun.
export function monthsOfYear(year: number) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

// Rentang tanggal kalender [start, end) untuk filter kolom `date`.
export function monthRange(year: number, month: number) {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const pad = (value: number) => String(value).padStart(2, "0");
  return { start: `${year}-${pad(month)}-01`, end: `${next.year}-${pad(next.month)}-01` };
}

export function yearRange(year: number) {
  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}

export function dayRange(date: string) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: date, end: next.toISOString().slice(0, 10) };
}
