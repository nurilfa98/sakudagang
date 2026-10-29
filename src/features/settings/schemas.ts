// Skema form Pengaturan platform (Superadmin): kontak admin, rekening,
// masa gratis & tenggang. Harga paket ada di features/subscriptions/schemas.ts.

import { z } from "zod";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { integerField } from "@/lib/validation";

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
  freeDays: integerField("Masa gratis", { min: 0, max: 365 }),
  graceDays: integerField("Masa tenggang", { min: 0, max: 60 }),
});

// Rekening bank tujuan transfer (boleh lebih dari satu, nama bank bebas).
export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(2, "Nama bank minimal 2 karakter").max(50, "Nama bank maksimal 50 karakter"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[\d\s-]*$/, "Nomor rekening hanya boleh berisi angka")
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(z.string().min(5, "Nomor rekening minimal 5 digit").max(50, "Nomor rekening maksimal 50 digit")),
  accountName: z.string().trim().min(2, "Nama pemilik rekening wajib diisi").max(100, "Maksimal 100 karakter"),
});

export const bankAccountIdSchema = z.string().min(1).max(36);

// Gambar QRIS statis: PNG/JPG maksimal 2 MB.
export const QRIS_MAX_BYTES = 2 * 1024 * 1024;
export const QRIS_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
