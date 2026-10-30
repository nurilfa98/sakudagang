// Skema validasi penjualan (kasir). Dipakai di client dan server.
//
// Layar kasir memanggil createSale() langsung dari event handler dengan objek
// (bukan FormData), jadi nilai di sini sudah berupa angka. Server tetap
// memvalidasi ulang semuanya: Server Action adalah endpoint publik.

import { z } from "zod";
import { parseParam, type SearchParams } from "@/lib/filters";
import {
  MAX_SALE_ITEMS,
  PAYMENT_METHODS,
  SALE_STATUSES,
  type PaymentMethod,
  type SaleStatus,
} from "./constants";
import { calculateSaleTotals } from "./service";

const MAX_RUPIAH = 999_999_999_999;

export const saleItemSchema = z.object({
  productId: z.string().min(1).max(36),
  qty: z.number("Jumlah wajib diisi").int("Jumlah harus angka bulat").min(1, "Jumlah minimal 1").max(1_000_000, "Jumlah terlalu besar"),
  // Harga jual master saat itu, atau harga yang diubah kasir untuk transaksi ini.
  sellingPrice: z.number("Harga wajib diisi").int().min(1, "Harga minimal 1").max(MAX_RUPIAH, "Harga terlalu besar"),
});

export const saleSchema = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHODS, "Pilih metode bayar"),
    customerId: z.string().max(36).nullable(),
    // Hanya tunai: uang yang diberikan pembeli.
    cashReceived: z.number().int().min(0).max(MAX_RUPIAH).nullable(),
    items: z
      .array(saleItemSchema)
      .min(1, "Keranjang masih kosong")
      .max(MAX_SALE_ITEMS, `Maksimal ${MAX_SALE_ITEMS} barang per transaksi`),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.items.forEach((item, index) => {
      if (seen.has(item.productId)) {
        ctx.addIssue({ code: "custom", path: ["items", index, "productId"], message: "Barang dobel di keranjang" });
      }
      seen.add(item.productId);
    });

    if (data.paymentMethod === "CREDIT" && !data.customerId) {
      ctx.addIssue({ code: "custom", path: ["customerId"], message: "Pilih pelanggan untuk bon" });
    }
    if (data.paymentMethod === "CASH") {
      // Total tidak bergantung harga modal, jadi bisa dicek di sini.
      const { total } = calculateSaleTotals(data.items.map((item) => ({ ...item, costPrice: 0 })));
      if (data.cashReceived == null || data.cashReceived < total) {
        ctx.addIssue({ code: "custom", path: ["cashReceived"], message: "Uang diterima kurang dari total" });
      }
    }
  });

export type SaleInput = z.input<typeof saleSchema>;

export const saleIdSchema = z.string().min(1).max(36);

export const voidSaleSchema = z.object({
  saleId: saleIdSchema,
  reason: z.string().trim().min(1, "Alasan pembatalan wajib diisi").max(500, "Alasan maksimal 500 karakter"),
});

// ---------------------------------------------------------------------------
// Filter riwayat penjualan (URL: ?date=&method=&status=)
// ---------------------------------------------------------------------------

// Satu hari per tampilan (bawaan: hari ini, diisi halaman), karena warung
// bisa punya ratusan transaksi per hari dan daftar dibatasi 500 baris.
export type SaleFilters = { date?: string; paymentMethod?: PaymentMethod; status?: SaleStatus };

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function parseSaleFilters(params: SearchParams): SaleFilters {
  return {
    date: parseParam(dateParam, params.date),
    paymentMethod: parseParam(z.enum(PAYMENT_METHODS), params.method),
    status: parseParam(z.enum(SALE_STATUSES), params.status),
  };
}
