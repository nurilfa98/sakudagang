// Server Action untuk kelola toko (tenant).
//
// Setiap action mengecek hak akses sendiri, walaupun halamannya sudah
// dilindungi: Server Action bisa dipanggil langsung lewat POST tanpa membuka
// halamannya.
//
// - Superadmin (store:manage): buat, ubah, nonaktifkan toko mana pun.
// - Pemilik (store:edit-own): hanya mengubah data tokonya sendiri.
// - Toko TIDAK dihapus, hanya dinonaktifkan; semua user toko itu otomatis
//   tidak bisa login (lib/auth/dal.ts mengecek stores.is_active).
//
// Referensi:
// - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
// - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearActiveStoreCookie, setActiveStoreCookie } from "@/lib/auth/active-store";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { expenseCategories, productCategories, stores } from "@/lib/db/schema";
import { getPlatformSettings } from "@/lib/platform-settings";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_PRODUCT_CATEGORIES } from "@/lib/store-defaults";
import { addDays } from "@/lib/subscription-access";
import type { ActionResult } from "@/types/action-result";
import { getStore } from "./queries";
import { storeIdSchema, storeSchema } from "./schemas";
import { canEditStore } from "./service";

const FORBIDDEN = { success: false, message: "Anda tidak memiliki akses." } as const;
const NOT_FOUND = { success: false, message: "Toko tidak ditemukan." } as const;

function parseStoreForm(formData: FormData) {
  return storeSchema.safeParse({
    name: formData.get("name"),
    businessType: formData.get("businessType"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    timezone: formData.get("timezone"),
  });
}

// Setelah toko dibuat, Superadmin diarahkan ke halaman detailnya untuk
// langsung menambahkan akun Pemilik.
export async function createStore(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "store:manage")) return FORBIDDEN;

  const parsed = parseStoreForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  // Masa gratis toko baru (BUSINESS-FLOW §14.1), lamanya dari Pengaturan.
  const { freeDays } = await getPlatformSettings();
  const subscriptionUntil = addDays(new Date(), freeDays);

  // Toko + kategori barang & pengeluaran awal dalam satu transaksi
  // (docs/DATABASE-SCHEMA.md §9).
  const created = await db.transaction(async (tx) => {
    const [store] = await tx
      .insert(stores)
      .values({ ...parsed.data, subscriptionUntil })
      .returning({ id: stores.id });
    await tx
      .insert(productCategories)
      .values(DEFAULT_PRODUCT_CATEGORIES.map((name, index) => ({ storeId: store.id, name, sortOrder: index + 1 })));
    await tx
      .insert(expenseCategories)
      .values(DEFAULT_EXPENSE_CATEGORIES.map((name, index) => ({ storeId: store.id, name, sortOrder: index + 1 })));
    return store;
  });

  revalidateStores();
  redirect(`/stores/${created.id}`);
}

export async function updateStore(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await verifySession();

  const storeId = storeIdSchema.safeParse(formData.get("storeId"));
  if (!storeId.success) return NOT_FOUND;
  if (!canEditStore(actor, storeId.data)) return FORBIDDEN;

  const parsed = parseStoreForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const [row] = await db
    .update(stores)
    .set(parsed.data)
    .where(eq(stores.id, storeId.data))
    .returning({ id: stores.id });
  if (!row) return NOT_FOUND;

  revalidateStores();
  return { success: true, data: undefined };
}

// Dipanggil dari event handler (bukan form), jadi argumennya bisa dikirim
// siapa saja dengan nilai apa saja. Keduanya divalidasi ulang dengan zod.
export async function setStoreActive(storeId: string, active: boolean): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "store:manage")) return FORBIDDEN;

  const input = z.object({ storeId: storeIdSchema, active: z.boolean() }).safeParse({ storeId, active });
  if (!input.success) return NOT_FOUND;

  const [row] = await db
    .update(stores)
    .set({ isActive: input.data.active })
    .where(eq(stores.id, input.data.storeId))
    .returning({ id: stores.id });
  if (!row) return NOT_FOUND;

  revalidateStores();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Superadmin masuk / keluar toko (lib/auth/active-store.ts)
// ---------------------------------------------------------------------------

// Dipanggil dari <form action={enterStore}> (tombol Buka di kartu & detail
// toko): hidden input storeId + redirectTo opsional (bawaan: kotak menu toko).
// Gagal validasi → kembali ke daftar toko.
export async function enterStore(formData: FormData) {
  const actor = await verifySession();
  if (!can(actor, "store:manage")) redirect("/");

  const input = z
    .object({
      storeId: storeIdSchema,
      // Hanya path internal, agar tidak bisa dipakai mengarahkan ke situs lain.
      redirectTo: z.string().regex(/^\/(?!\/)[^\s]*$/).default("/"),
    })
    .safeParse({ storeId: formData.get("storeId"), redirectTo: formData.get("redirectTo") ?? undefined });
  if (!input.success) redirect("/stores");

  const store = await getStore(input.data.storeId);
  if (!store) redirect("/stores");

  await setActiveStoreCookie(store.id);
  // Data user (termasuk activeStore) di-cache per sesi; buang agar menu &
  // halaman langsung memakai toko yang baru dipilih.
  revalidatePath("/", "layout");
  redirect(input.data.redirectTo);
}

export async function leaveStore() {
  const actor = await verifySession();
  if (can(actor, "store:manage")) await clearActiveStoreCookie();
  revalidatePath("/", "layout");
  // Kembali ke daftar toko untuk memilih toko lain.
  redirect("/stores");
}

function invalid(error: z.ZodError) {
  return {
    success: false as const,
    message: "Periksa kembali isian Anda.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

// "layout" mencakup /stores, /stores/new, dan /stores/[id]. Daftar pengguna
// menampilkan nama toko, jadi ikut dimuat ulang.
function revalidateStores() {
  revalidatePath("/stores", "layout");
  revalidatePath("/users", "layout");
}
