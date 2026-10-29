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

// Pemilik memilih paket.
export const requestSubscriptionSchema = z.object({ months: planMonthsSchema });

// Superadmin menandai lunas, dengan catatan opsional (referensi transfer).
export const confirmPaymentSchema = z.object({ subscriptionId: subscriptionIdSchema, note });

// Superadmin membuat tagihan atas nama toko (pemilik bayar langsung saat
// kunjungan). `paid` = langsung tandai lunas.
export const adminSubscriptionSchema = z.object({
  storeId: idParam,
  months: planMonthsSchema,
  note,
  paid: z.boolean(),
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
