// GET /api/reports/export?type=monthly&year=2026&month=10
//     /api/reports/export?type=yearly&year=2026
// Unduh rincian laporan bulanan (per hari) / tahunan (per bulan) sebagai
// Excel (.xlsx), angka sama persis dengan halaman laporan (features/reports/period.ts).
// Hanya Pemilik (report:view) untuk toko yang sedang dibuka.

import type { NextRequest } from "next/server";
import { monthlyBreakdown, yearlyBreakdown } from "@/features/reports/period";
import { parseExportType, parseReportPeriod } from "@/features/reports/schemas";
import { requireStore } from "@/lib/auth/dal";
import { zonedDateString } from "@/lib/dates";
import { xlsxResponse } from "@/lib/excel";

const RUPIAH_FORMAT = "#,##0";

export async function GET(request: NextRequest) {
  const actor = await requireStore("report:view");
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const type = parseExportType(params);
  const period = parseReportPeriod(params);
  const [currentYear, currentMonth] = zonedDateString(new Date()).split("-").map(Number);
  const year = period.year ?? currentYear;

  if (!type) return new Response("Jenis laporan tidak valid.", { status: 400 });

  const month = period.month ?? currentMonth;
  const rows =
    type === "monthly" ? await monthlyBreakdown(actor.storeId, year, month) : await yearlyBreakdown(actor.storeId, year);
  const total = rows.reduce(
    (sum, row) => ({
      omset: sum.omset + row.omset,
      hpp: sum.hpp + row.hpp,
      grossProfit: sum.grossProfit + row.grossProfit,
      expenses: sum.expenses + row.expenses,
      shrinkage: sum.shrinkage + row.shrinkage,
      netProfit: sum.netProfit + row.netProfit,
    }),
    { omset: 0, hpp: 0, grossProfit: 0, expenses: 0, shrinkage: 0, netProfit: 0 },
  );

  const toRow = (label: string, row: typeof total, bold = false) => [
    { value: label, type: String, ...(bold ? { fontWeight: "bold" as const } : {}) },
    ...[row.omset, row.hpp, row.grossProfit, row.expenses, row.shrinkage, row.netProfit].map((value) => ({
      value,
      type: Number,
      format: RUPIAH_FORMAT,
      ...(bold ? { fontWeight: "bold" as const } : {}),
    })),
  ];

  const name = type === "monthly" ? `${year}-${String(month).padStart(2, "0")}` : String(year);
  return xlsxResponse({
    filename: `laporan-${type === "monthly" ? "bulanan" : "tahunan"}-${name}.xlsx`,
    sheet: type === "monthly" ? "Per hari" : "Per bulan",
    columns: [
      { header: type === "monthly" ? "Tanggal" : "Bulan", width: 18 },
      { header: "Omset (Rp)", width: 16 },
      { header: "HPP (Rp)", width: 16 },
      { header: "Laba kotor (Rp)", width: 16 },
      { header: "Pengeluaran (Rp)", width: 16 },
      { header: "Penyusutan (Rp)", width: 16 },
      { header: "Laba bersih (Rp)", width: 16 },
    ],
    rows: [...rows.map((row) => toRow(row.label, row)), toRow("Total", total, true)],
  });
}
