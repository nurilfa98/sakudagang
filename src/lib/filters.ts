// Helper filter URL untuk halaman daftar (docs/ARCHITECTURE.md §3 "Daftar data").
//
// Filter (status, bulan, kategori, …) disimpan di query string halaman,
// misalnya /users?role=CASHIER&status=ACTIVE, lalu dibaca Server Component
// lewat searchParams dan diterapkan di SQL. Setiap fitur punya fungsi
// parse<Fitur>Filters() di schemas.ts yang memakai helper di sini.
//
// Prinsip: nilai yang tidak valid (diketik manual di URL) DIABAIKAN, bukan
// error, supaya halaman tetap terbuka dengan filter yang masuk akal.
//
// Referensi: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md (searchParams)

import { z } from "zod";

// Bentuk searchParams dari Next.js setelah di-await.
export type SearchParams = Record<string, string | string[] | undefined>;

// ?status=A&status=B → "A". Daftar hanya memakai satu nilai per filter.
export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// Parse satu nilai URL dengan skema zod; tidak valid/kosong → undefined.
export function parseParam<T>(schema: z.ZodType<T>, value: string | string[] | undefined): T | undefined {
  const first = firstParam(value);
  if (first === undefined || first === "") return undefined;
  return schema.safeParse(first).data;
}

export const yearParam = z.coerce.number().int().min(2000).max(2100);
export const monthParam = z.coerce.number().int().min(1).max(12);
export const idParam = z.string().min(1).max(36);

// Jumlah filter yang terisi, untuk angka di tombol "Filter".
export function countActiveFilters(filters: Record<string, unknown>) {
  return Object.values(filters).filter((value) => value !== undefined).length;
}

// Pilihan tahun dari `from` sampai tahun ini, terbaru dulu. Untuk dropdown
// tahun bila tidak perlu query "tahun yang punya data".
export function yearsSince(from: number, now = new Date()) {
  const current = now.getFullYear();
  const start = Math.min(from, current);
  return Array.from({ length: current - start + 1 }, (_, index) => current - index);
}
