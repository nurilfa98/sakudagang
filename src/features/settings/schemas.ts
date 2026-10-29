// Skema form Pengaturan platform (Superadmin): kontak admin, rekening,
// masa gratis & tenggang. Harga paket ada di features/subscriptions/schemas.ts.

import { z } from "zod";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { integerField } from "@/lib/validation";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .transform((value) => value || null);

// Nomor WhatsApp admin: kosong → null, selain itu dinormalisasi ke 62…
const adminPhone = z.string().transform((value, ctx) => {
  if (!value.trim()) return null;
  const normalized = normalizeIndonesianPhone(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid, contoh: 0812-3456-7890" });
    return z.NEVER;
  }
  return normalized;
});

export const platformSettingsSchema = z.object({
  adminPhone,
  bankName: optionalText(50, "Nama bank"),
  bankAccountNumber: z
    .string()
    .trim()
    .max(50, "Nomor rekening maksimal 50 karakter")
    .regex(/^[\d\s-]*$/, "Nomor rekening hanya boleh berisi angka")
    .transform((value) => value.replace(/[\s-]/g, "") || null),
  bankAccountName: optionalText(100, "Nama pemilik rekening"),
  freeDays: integerField("Masa gratis", { min: 0, max: 365 }),
  graceDays: integerField("Masa tenggang", { min: 0, max: 60 }),
});

// Gambar QRIS statis: PNG/JPG maksimal 2 MB.
export const QRIS_MAX_BYTES = 2 * 1024 * 1024;
export const QRIS_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
