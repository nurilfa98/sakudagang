// Field zod yang dipakai berulang di banyak form (barang, pembelian, kasir).
//
// Input nominal di form menampilkan pemisah ribuan ("18.500"), jadi server
// membuang semua karakter selain angka sebelum validasi (ARCHITECTURE.md §5).
// Qty dan nominal selalu bilangan bulat.

import { z } from "zod";

const MAX_RUPIAH = 999_999_999_999; // 999 miliar, jauh di atas kebutuhan warung

// "Rp 18.500" → 18500. min bawaan 0.
export function rupiahField(label: string, { min = 0 }: { min?: number } = {}) {
  return z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().min(1, `${label} wajib diisi`))
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(min, min > 0 ? `${label} minimal ${min.toLocaleString("id-ID")}` : `${label} tidak boleh negatif`)
        .max(MAX_RUPIAH, `${label} terlalu besar`),
    );
}

// Bilangan bulat dari input teks. Kosong → null bila optional, selain itu error.
export function integerField(label: string, { min = 0, max = 1_000_000_000 }: { min?: number; max?: number } = {}) {
  return z
    .string()
    .transform((value) => value.trim().replace(/[.\s]/g, ""))
    .pipe(z.string().min(1, `${label} wajib diisi`).regex(/^-?\d+$/, `${label} harus angka bulat`))
    .transform(Number)
    .pipe(z.number().int().min(min, `${label} minimal ${min}`).max(max, `${label} terlalu besar`));
}

export function optionalIntegerField(label: string, options?: { min?: number; max?: number }) {
  return z.string().transform((value, ctx) => {
    if (!value.trim()) return null;
    const result = integerField(label, options).safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) ctx.addIssue({ code: "custom", message: issue.message });
      return z.NEVER;
    }
    return result.data;
  });
}
