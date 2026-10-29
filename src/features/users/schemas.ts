// Skema validasi form tambah & edit pengguna.
//
// Selain memvalidasi, skema juga MERAPIKAN data sebelum disimpan
// (trim, email huruf kecil), sehingga data di database selalu seragam.
//
// Referensi:
// - https://zod.dev/api#transforms
// - node_modules/next/dist/docs/01-app/02-guides/forms.md (bagian "Form validation")

import { z } from "zod";
import { idParam, parseParam, type SearchParams } from "@/lib/filters";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { ASSIGNABLE_ROLES, type AssignableRole } from "./service";

const fullName = z.string().trim().min(2, "Nama minimal 2 karakter").max(100, "Nama maksimal 100 karakter");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(100, "Email maksimal 100 karakter")
  .pipe(z.email("Format email tidak valid"));

// Nomor WhatsApp opsional: kosong → null, selain itu dinormalisasi ke 62…
// transform bisa sekaligus memvalidasi: kembalikan z.NEVER + addIssue bila gagal.
const phone = z.string().transform((value, ctx) => {
  if (!value.trim()) return null;
  const normalized = normalizeIndonesianPhone(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid, contoh: 0812-3456-7890" });
    return z.NEVER;
  }
  return normalized;
});

// id yang dikirim dari browser (form / event handler) juga wajib divalidasi.
export const userIdSchema = z.string().min(1).max(36);

export const createUserSchema = z.object({
  fullName,
  email,
  phone,
  role: z.enum(ASSIGNABLE_ROLES, "Pilih role"),
  storeId: z.string().min(1, "Pilih toko").max(36),
});

export const updateUserSchema = z.object({ fullName, email, phone });

// ---------------------------------------------------------------------------
// Filter daftar pengguna (URL: ?storeId=&role=&status=)
// ---------------------------------------------------------------------------

// PENDING = akun aktif tapi belum pernah login (password sementara).
export const USER_STATUS_FILTERS = ["ACTIVE", "PENDING", "INACTIVE"] as const;

export type UserFilters = {
  storeId?: string; // hanya Superadmin; Pemilik selalu terkunci ke tokonya
  role?: AssignableRole;
  status?: (typeof USER_STATUS_FILTERS)[number];
};

export function parseUserFilters(params: SearchParams, { allowStore }: { allowStore: boolean }): UserFilters {
  return {
    storeId: allowStore ? parseParam(idParam, params.storeId) : undefined,
    role: parseParam(z.enum(ASSIGNABLE_ROLES), params.role),
    status: parseParam(z.enum(USER_STATUS_FILTERS), params.status),
  };
}
