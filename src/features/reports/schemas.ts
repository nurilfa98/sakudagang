// Periode laporan dari URL. Nilai tidak valid diabaikan (bawaan = hari /
// bulan / tahun ini, diisi halaman karena "hari ini" mengikuti zona toko).

import { z } from "zod";
import { firstParam, monthParam, parseParam, yearParam, type SearchParams } from "@/lib/filters";

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type ReportPeriod = { date?: string; year?: number; month?: number };

export function parseReportPeriod(params: SearchParams): ReportPeriod {
  return {
    date: parseParam(dateParam, params.date),
    year: parseParam(yearParam, params.year),
    month: parseParam(monthParam, params.month),
  };
}

// Jenis ekspor Excel: /api/reports/export?type=monthly&year=2026&month=10
export const REPORT_EXPORT_TYPES = ["monthly", "yearly"] as const;

export function parseExportType(params: SearchParams) {
  return z.enum(REPORT_EXPORT_TYPES).safeParse(firstParam(params.type)).data;
}
