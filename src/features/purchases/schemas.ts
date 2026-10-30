// Skema validasi pembelian (barang masuk). Dipakai di client dan server.

import { z } from "zod";
import { monthParam, parseParam, yearParam, type SearchParams } from "@/lib/filters";
import { integerField, rupiahField } from "@/lib/validation";
import { MAX_PURCHASE_ITEMS, PURCHASE_STATUSES, type PurchaseStatus } from "./constants";

// Nilai baris dikirim sebagai teks (isi input apa adanya) agar aturan
// rupiah/qty sama dengan form lain (lib/validation.ts).
export const purchaseItemSchema = z.object({
  productId: z.string().min(1).max(36),
  qty: integerField("Jumlah", { min: 1 }),
  unitCost: rupiahField("Harga beli", { min: 1 }),
  // Kosong = harga jual tidak diubah.
  newSellingPrice: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.number().int().min(1, "Harga jual minimal 1").max(999_999_999_999, "Harga jual terlalu besar").nullable()),
});

export const purchaseSchema = z
  .object({
    // Format <input type="date">. "Tidak boleh di masa depan" dicek di action
    // karena "hari ini" mengikuti zona waktu toko (lib/dates.ts, khusus server).
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
    note: z
      .string()
      .trim()
      .max(500, "Catatan maksimal 500 karakter")
      .transform((value) => value || null),
    items: z
      .array(purchaseItemSchema)
      .min(1, "Tambahkan minimal satu barang")
      .max(MAX_PURCHASE_ITEMS, `Maksimal ${MAX_PURCHASE_ITEMS} barang per pembelian`),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.items.forEach((item, index) => {
      if (seen.has(item.productId)) {
        ctx.addIssue({ code: "custom", path: ["items", index, "productId"], message: "Barang ini sudah ada di daftar" });
      }
      seen.add(item.productId);
    });
  });

export const purchaseIdSchema = z.string().min(1).max(36);

export const voidPurchaseSchema = z.object({
  purchaseId: purchaseIdSchema,
  reason: z.string().trim().min(1, "Alasan pembatalan wajib diisi").max(500, "Alasan maksimal 500 karakter"),
});

// ---------------------------------------------------------------------------
// Filter daftar pembelian (URL: ?status=&year=&month=)
// ---------------------------------------------------------------------------

export type PurchaseFilters = { status?: PurchaseStatus; year?: number; month?: number };

// Bulan hanya berlaku bila tahun dipilih.
export function parsePurchaseFilters(params: SearchParams): PurchaseFilters {
  const year = parseParam(yearParam, params.year);
  return {
    status: parseParam(z.enum(PURCHASE_STATUSES), params.status),
    year,
    month: year ? parseParam(monthParam, params.month) : undefined,
  };
}
