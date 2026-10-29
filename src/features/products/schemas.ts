// Skema validasi form barang & kategori. Dipakai di client dan server.

import { z } from "zod";
import { idParam, monthParam, parseParam, yearParam, type SearchParams } from "@/lib/filters";
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from "@/lib/stock-types";
import { integerField, optionalIntegerField, rupiahField } from "@/lib/validation";

const name = z.string().trim().min(1, "Nama barang wajib diisi").max(100, "Nama barang maksimal 100 karakter");

export const productSchema = z.object({
  name,
  categoryId: z.string().min(1, "Pilih kategori").max(36),
  unit: z.string().trim().min(1, "Satuan wajib diisi").max(20, "Satuan maksimal 20 karakter"),
  sellingPrice: rupiahField("Harga jual", { min: 1 }),
  minStock: optionalIntegerField("Stok minimum"),
});

// Tambah barang: boleh sekaligus mengisi stok awal + harga modalnya
// (dicatat sebagai mutasi INITIAL). Keduanya kosong = barang mulai dari stok 0.
export const createProductSchema = productSchema
  .extend({
    initialStock: optionalIntegerField("Stok awal"),
    initialCostPrice: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .transform((value) => (value ? Number(value) : null)),
  })
  .superRefine((data, ctx) => {
    if (data.initialStock && data.initialStock > 0 && !data.initialCostPrice) {
      ctx.addIssue({ code: "custom", path: ["initialCostPrice"], message: "Isi harga modal untuk stok awal ini" });
    }
  });

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(50, "Nama kategori maksimal 50 karakter"),
});

// Qty pembelian/penjualan nanti memakai ini juga.
export const qtySchema = integerField("Jumlah", { min: 1 });

export const productIdSchema = z.string().min(1).max(36);
export const categoryIdSchema = z.string().min(1).max(36);

// ---------------------------------------------------------------------------
// Filter daftar barang (URL: ?category=&status=&stock=)
// ---------------------------------------------------------------------------

export const PRODUCT_STATUS_FILTERS = ["ACTIVE", "INACTIVE"] as const;
export const PRODUCT_STOCK_FILTERS = ["LOW"] as const; // LOW = minus atau ≤ stok minimum

export type ProductFilters = {
  categoryId?: string;
  status?: (typeof PRODUCT_STATUS_FILTERS)[number];
  stock?: (typeof PRODUCT_STOCK_FILTERS)[number];
};

export function parseProductFilters(params: SearchParams): ProductFilters {
  return {
    categoryId: parseParam(idParam, params.category),
    status: parseParam(z.enum(PRODUCT_STATUS_FILTERS), params.status),
    stock: parseParam(z.enum(PRODUCT_STOCK_FILTERS), params.stock),
  };
}

// Filter riwayat mutasi stok (URL: ?type=&year=&month=). Bulan hanya
// berlaku bila tahun dipilih.
export type StockMovementFilters = { type?: StockMovementType; year?: number; month?: number };

export function parseStockMovementFilters(params: SearchParams): StockMovementFilters {
  const year = parseParam(yearParam, params.year);
  return {
    type: parseParam(z.enum(STOCK_MOVEMENT_TYPES), params.type),
    year,
    month: year ? parseParam(monthParam, params.month) : undefined,
  };
}
