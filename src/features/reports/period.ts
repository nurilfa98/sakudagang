// Menyusun data periode laporan (server): rentang tanggal, rincian per
// hari/bulan berlabel, dan pilihan tahun. Dipakai halaman laporan, beranda
// Pemilik, dan ekspor Excel agar angkanya selalu sama.

import "server-only";
import { formatDateOnly } from "@/lib/dates";
import { MONTH_NAMES } from "@/lib/format";
import { getBreakdownSources, listReportYears } from "./queries";
import { buildBreakdown, daysOfMonth, monthRange, monthsOfYear, yearRange } from "./service";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Rincian per hari dalam satu bulan; `tick` = nomor hari untuk sumbu grafik.
export async function monthlyBreakdown(storeId: string, year: number, month: number) {
  const sources = await getBreakdownSources(storeId, monthRange(year, month), "day");
  return buildBreakdown(daysOfMonth(year, month), sources).map((row) => ({
    ...row,
    label: formatDateOnly(row.key),
    tick: String(Number(row.key.slice(8))),
  }));
}

// Rincian per bulan dalam satu tahun; `tick` = nama bulan singkat.
export async function yearlyBreakdown(storeId: string, year: number) {
  const sources = await getBreakdownSources(storeId, yearRange(year), "month");
  return buildBreakdown(monthsOfYear(year), sources).map((row) => {
    const month = Number(row.key.slice(5));
    return { ...row, label: `${MONTH_NAMES[month - 1]} ${year}`, tick: SHORT_MONTHS[month - 1] };
  });
}

// Tahun yang punya penjualan + tahun ini (dan tahun terpilih), terbaru dulu.
export async function reportYears(storeId: string, currentYear: number, selected?: number) {
  const years = new Set([...(await listReportYears(storeId)), currentYear, ...(selected ? [selected] : [])]);
  return [...years].sort((a, b) => b - a);
}
