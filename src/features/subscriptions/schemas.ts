// Skema validasi fitur langganan: input action (dari browser, wajib
// divalidasi ulang) dan filter daftar tagihan (URL).

import { z } from "zod";
import { idParam, parseParam, yearParam, type SearchParams } from "@/lib/filters";
import { rupiahField } from "@/lib/validation";
import { PLAN_MONTHS, SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "./constants";

// "6" dari form/select → 6, dan harus salah satu dari PLAN_MONTHS.
export const planMonthsSchema = z.coerce
  .number()
  .int()
  .refine((value): value is (typeof PLAN_MONTHS)[number] => (PLAN_MONTHS as readonly number[]).includes(value), {
    message: "Pilih paket",
  });

export const subscriptionIdSchema = z.string().min(1).max(36);

const note = z
  .string()
  .trim()
  .max(255, "Catatan maksimal 255 karakter")
  .transform((value) => value || null);

// Pemilik klik "Saya sudah bayar": paket yang dipilih (tagihan baru) ATAU id
// tagihan kurang bayar yang dilengkapi, + catatan opsional (bank pengirim,
// jam transfer). Bukti (file) divalidasi di action.
export const claimPaymentSchema = z.object({
  months: planMonthsSchema.optional(),
  subscriptionId: subscriptionIdSchema.optional(),
  note,
});

export const paymentIdSchema = z.string().min(1).max(36);

// Superadmin menerima pembayaran: nominal yang benar-benar masuk (wajib > 0)
// + keterangan opsional (referensi transfer).
export const acceptPaymentSchema = z.object({
  paymentId: paymentIdSchema,
  amountReceived: rupiahField("Nominal diterima", { min: 1 }),
  note,
});

// Superadmin menolak satu pembayaran: alasan WAJIB, tampil ke pemilik.
export const rejectPaymentSchema = z.object({
  paymentId: paymentIdSchema,
  reason: z.string().trim().min(5, "Tulis alasan penolakan (minimal 5 karakter)").max(255),
});


// Superadmin mencatat pembayaran langsung atas nama toko (pemilik bayar
// tunai/transfer saat kunjungan): langsung lunas.
export const adminSubscriptionSchema = z.object({
  storeId: idParam,
  months: planMonthsSchema,
  note,
});

// Harga paket standar (Pengaturan): tiga nominal, 0 = belum diatur.
export const planPricesSchema = z.object({
  price1: rupiahField("Harga 1 bulan"),
  price6: rupiahField("Harga 6 bulan"),
  price12: rupiahField("Harga 1 tahun"),
});

// Harga khusus per toko: kosong = pakai harga standar (hapus harga khusus).
const optionalRupiah = (label: string) =>
  z.string().transform((value, ctx) => {
    if (!value.replace(/\D/g, "")) return null;
    const result = rupiahField(label, { min: 1 }).safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) ctx.addIssue({ code: "custom", message: issue.message });
      return z.NEVER;
    }
    return result.data;
  });

export const storePlanPricesSchema = z.object({
  storeId: idParam,
  price1: optionalRupiah("Harga 1 bulan"),
  price6: optionalRupiah("Harga 6 bulan"),
  price12: optionalRupiah("Harga 1 tahun"),
  note,
});

// ---------------------------------------------------------------------------
// Filter daftar tagihan (URL: ?status=&year=&storeId=)
// ---------------------------------------------------------------------------

export type SubscriptionFilters = {
  status?: SubscriptionStatus;
  year?: number; // tahun tagihan dibuat
  storeId?: string; // hanya halaman Tagihan (Superadmin)
};

export function parseSubscriptionFilters(params: SearchParams, { allowStore }: { allowStore: boolean }): SubscriptionFilters {
  return {
    status: parseParam(z.enum(SUBSCRIPTION_STATUSES), params.status),
    year: parseParam(yearParam, params.year),
    storeId: allowStore ? parseParam(idParam, params.storeId) : undefined,
  };
}
