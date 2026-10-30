// Skema validasi pengeluaran operasional & kategorinya. Dipakai di client dan server.

import { z } from "zod";
import { idParam, monthParam, parseParam, yearParam, type SearchParams } from "@/lib/filters";
import { rupiahField } from "@/lib/validation";

export const expenseSchema = z.object({
  // Format <input type="date">. "Tidak boleh di masa depan" dicek di action
  // karena "hari ini" mengikuti zona waktu toko (lib/dates.ts, khusus server).
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  categoryId: z.string().min(1, "Pilih kategori").max(36),
  amount: rupiahField("Nominal", { min: 1 }),
  note: z
    .string()
    .trim()
    .max(500, "Keterangan maksimal 500 karakter")
    .transform((value) => value || null),
});

export const expenseIdSchema = z.string().min(1).max(36);

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(50, "Nama kategori maksimal 50 karakter"),
});

// ---------------------------------------------------------------------------
// Filter daftar pengeluaran (URL: ?year=&month=&category=)
// ---------------------------------------------------------------------------

export type ExpenseFilters = { year?: number; month?: number; categoryId?: string };

// Bulan hanya berlaku bila tahun dipilih.
export function parseExpenseFilters(params: SearchParams): ExpenseFilters {
  const year = parseParam(yearParam, params.year);
  return {
    year,
    month: year ? parseParam(monthParam, params.month) : undefined,
    categoryId: parseParam(idParam, params.category),
  };
}
