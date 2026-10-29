// Skema validasi form toko. Selain memvalidasi, skema juga merapikan data
// (trim, string kosong → null) sehingga data di database seragam.

import { z } from "zod";
import { parseParam, type SearchParams } from "@/lib/filters";
import { TIMEZONE_VALUES } from "./constants";

// Kolom opsional: string kosong dari form disimpan sebagai NULL.
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .transform((value) => value || null);

export const storeSchema = z.object({
  name: z.string().trim().min(2, "Nama toko minimal 2 karakter").max(100, "Nama toko maksimal 100 karakter"),
  businessType: optionalText(50, "Jenis usaha"),
  address: optionalText(255, "Alamat"),
  phone: z
    .string()
    .trim()
    .max(20, "Nomor telepon maksimal 20 karakter")
    .regex(/^[\d+\-\s()]*$/, "Nomor telepon hanya boleh berisi angka")
    .transform((value) => value || null),
  timezone: z.enum(TIMEZONE_VALUES, "Pilih zona waktu"),
});

export type StoreInput = z.infer<typeof storeSchema>;

// id toko yang dikirim dari browser juga wajib divalidasi.
export const storeIdSchema = z.string().min(1).max(36);

// ---------------------------------------------------------------------------
// Filter daftar toko (URL: ?status=&type=)
// ---------------------------------------------------------------------------

export const STORE_STATUS_FILTERS = ["ACTIVE", "INACTIVE"] as const;

export type StoreFilters = {
  status?: (typeof STORE_STATUS_FILTERS)[number];
  businessType?: string; // teks bebas, dicocokkan persis dengan stores.business_type
};

export function parseStoreFilters(params: SearchParams): StoreFilters {
  return {
    status: parseParam(z.enum(STORE_STATUS_FILTERS), params.status),
    businessType: parseParam(z.string().trim().min(1).max(50), params.type),
  };
}
