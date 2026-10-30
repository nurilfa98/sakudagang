// Skema validasi stok opname. Dipakai di client dan server.
//
// Lembar hitung memanggil saveStockTakeCounts() langsung dengan objek (hanya
// baris yang berubah), jadi nilai di sini sudah berupa angka.

import { z } from "zod";
import { STOCK_TAKE_REASONS } from "./constants";

export const stockTakeIdSchema = z.string().min(1).max(36);

export const stockTakeCountSchema = z.object({
  productId: z.string().min(1).max(36),
  // null = belum dihitung (dikosongkan lagi).
  physicalQty: z.number().int("Stok fisik harus angka bulat").min(0, "Stok fisik tidak boleh negatif").max(1_000_000_000).nullable(),
  reason: z.enum(STOCK_TAKE_REASONS).nullable(),
  note: z
    .string()
    .trim()
    .max(255, "Catatan maksimal 255 karakter")
    .nullable()
    .transform((value) => value || null),
});

export const saveStockTakeCountsSchema = z.object({
  stockTakeId: stockTakeIdSchema,
  items: z.array(stockTakeCountSchema).max(10_000),
});

export type StockTakeCountInput = z.input<typeof stockTakeCountSchema>;
