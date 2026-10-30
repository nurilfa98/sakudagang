// Skema validasi pelanggan, pelunasan bon, dan filter piutang. Dipakai di client dan server.

import { z } from "zod";
import { parseParam, type SearchParams } from "@/lib/filters";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { CREDIT_PAYMENT_METHODS } from "./constants";

// Nomor WhatsApp opsional: kosong → null, selain itu dinormalisasi ke 62…
const phone = z.string().transform((value, ctx) => {
  if (!value.trim()) return null;
  const normalized = normalizeIndonesianPhone(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid, contoh: 0812-3456-7890" });
    return z.NEVER;
  }
  return normalized;
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Nama pelanggan wajib diisi").max(100, "Nama maksimal 100 karakter"),
  phone,
  note: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .transform((value) => value || null),
});

// Ubah pelanggan (Pemilik): data + tanda boleh/tidak boleh bon.
export const updateCustomerSchema = customerSchema.extend({
  customerId: z.string().min(1).max(36),
  allowCredit: z.boolean(),
});

// Pelunasan bon dari dialog "Bayar bon". Tanggal = tanggal uang diterima;
// batas "tidak di masa depan / tidak sebelum tanggal bon" dicek di action
// karena "hari ini" mengikuti zona waktu toko (lib/dates.ts, khusus server).
export const creditPaymentSchema = z.object({
  saleId: z.string().min(1).max(36),
  amount: z.number("Nominal wajib diisi").int().min(1, "Nominal minimal 1").max(999_999_999_999, "Nominal terlalu besar"),
  paymentMethod: z.enum(CREDIT_PAYMENT_METHODS, "Pilih metode bayar"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
});

export type CreditPaymentInput = z.input<typeof creditPaymentSchema>;

export const voidCreditPaymentSchema = z.object({
  paymentId: z.string().min(1).max(36),
  reason: z.string().trim().min(1, "Alasan pembatalan wajib diisi").max(500, "Alasan maksimal 500 karakter"),
});

// ---------------------------------------------------------------------------
// Filter daftar pelanggan & piutang (URL: ?credit=)
// ---------------------------------------------------------------------------

// OUTSTANDING = masih punya sisa bon; OVERDUE = punya bon lebih dari 30 hari.
export const CUSTOMER_CREDIT_FILTERS = ["OUTSTANDING", "OVERDUE"] as const;

export type CustomerFilters = { credit?: (typeof CUSTOMER_CREDIT_FILTERS)[number] };

export function parseCustomerFilters(params: SearchParams): CustomerFilters {
  return { credit: parseParam(z.enum(CUSTOMER_CREDIT_FILTERS), params.credit) };
}
