// Server Action untuk master barang & kategori (permission product:manage).
//
// Setiap action memanggil requireStore(): user harus login, punya permission,
// dan terikat satu toko; semua query memakai storeId dari situ, bukan dari input.
//
// Aturan penting:
// - Harga modal TIDAK bisa diedit langsung: hanya berubah lewat stok awal
//   (saat barang dibuat) dan pembelian (lib/stock.ts). Ini menjaga laba
//   terhitung konsisten.
// - Barang tidak dihapus, hanya dinonaktifkan.
// - Kategori hanya bisa dihapus bila tidak dipakai barang mana pun.

"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStore } from "@/lib/auth/dal";
import { db, isUniqueViolation } from "@/lib/db";
import { productCategories, products } from "@/lib/db/schema";
import { recordStockMovement } from "@/lib/stock";
import type { ActionResult } from "@/types/action-result";
import { categoryIdSchema, categorySchema, createProductSchema, productIdSchema, productSchema } from "./schemas";

const NOT_FOUND = { success: false, message: "Barang tidak ditemukan." } as const;
const CATEGORY_NOT_FOUND = { success: false, message: "Kategori tidak ditemukan." } as const;
const NAME_TAKEN = (what: string) => ({
  success: false as const,
  message: "Periksa kembali isian Anda.",
  fieldErrors: { name: [`${what} dengan nama ini sudah ada`] },
});

function productFormValues(formData: FormData) {
  return {
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    unit: formData.get("unit"),
    sellingPrice: formData.get("sellingPrice") ?? "",
    minStock: formData.get("minStock") ?? "",
  };
}

// ---------------------------------------------------------------------------
// Barang
// ---------------------------------------------------------------------------

// Tipe return sama dengan updateProduct agar satu komponen form bisa memakai
// keduanya lewat useActionState.
export async function createProduct(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await requireStore("product:manage");

  const parsed = createProductSchema.safeParse({
    ...productFormValues(formData),
    initialStock: formData.get("initialStock") ?? "",
    initialCostPrice: formData.get("initialCostPrice") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error);

  const { initialStock, initialCostPrice, ...data } = parsed.data;
  if (!(await categoryBelongsToStore(data.categoryId, actor.storeId))) return CATEGORY_NOT_FOUND;

  try {
    // Transaksi: barang + mutasi stok awal tersimpan bersamaan atau tidak sama sekali.
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(products)
        .values({ ...data, storeId: actor.storeId, costPrice: initialCostPrice ?? 0 })
        .returning({ id: products.id });

      if (initialStock && initialStock > 0) {
        await recordStockMovement(tx, {
          storeId: actor.storeId,
          productId: created.id,
          type: "INITIAL",
          qty: initialStock,
          costPrice: initialCostPrice ?? 0,
          createdById: actor.id,
        });
      }
    });

    revalidateProducts();
    return { success: true, data: undefined };
  } catch (error) {
    if (isUniqueViolation(error)) return NAME_TAKEN("Barang");
    throw error;
  }
}

export async function updateProduct(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await requireStore("product:manage");

  const productId = productIdSchema.safeParse(formData.get("productId"));
  if (!productId.success) return NOT_FOUND;

  const parsed = productSchema.safeParse(productFormValues(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (!(await categoryBelongsToStore(parsed.data.categoryId, actor.storeId))) return CATEGORY_NOT_FOUND;

  try {
    const [row] = await db
      .update(products)
      .set(parsed.data)
      .where(and(eq(products.id, productId.data), eq(products.storeId, actor.storeId)))
      .returning({ id: products.id });
    if (!row) return NOT_FOUND;
  } catch (error) {
    if (isUniqueViolation(error)) return NAME_TAKEN("Barang");
    throw error;
  }

  revalidateProducts();
  return { success: true, data: undefined };
}

// Dipanggil dari event handler; argumen divalidasi ulang dengan zod.
export async function setProductActive(productId: string, active: boolean): Promise<ActionResult> {
  const actor = await requireStore("product:manage");

  const input = z.object({ productId: productIdSchema, active: z.boolean() }).safeParse({ productId, active });
  if (!input.success) return NOT_FOUND;

  const [row] = await db
    .update(products)
    .set({ isActive: input.data.active })
    .where(and(eq(products.id, input.data.productId), eq(products.storeId, actor.storeId)))
    .returning({ id: products.id });
  if (!row) return NOT_FOUND;

  revalidateProducts();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Kategori
// ---------------------------------------------------------------------------

export async function createCategory(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await requireStore("product:manage");

  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return invalid(parsed.error);

  try {
    // Kategori baru di urutan paling bawah.
    const [{ last }] = await db
      .select({ last: count() })
      .from(productCategories)
      .where(eq(productCategories.storeId, actor.storeId));
    await db.insert(productCategories).values({ ...parsed.data, storeId: actor.storeId, sortOrder: last + 1 });
  } catch (error) {
    if (isUniqueViolation(error)) return NAME_TAKEN("Kategori");
    throw error;
  }

  revalidateProducts();
  return { success: true, data: undefined };
}

export async function renameCategory(categoryId: string, name: string): Promise<ActionResult> {
  const actor = await requireStore("product:manage");

  const id = categoryIdSchema.safeParse(categoryId);
  if (!id.success) return CATEGORY_NOT_FOUND;
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) return invalid(parsed.error);

  try {
    const [row] = await db
      .update(productCategories)
      .set(parsed.data)
      .where(and(eq(productCategories.id, id.data), eq(productCategories.storeId, actor.storeId)))
      .returning({ id: productCategories.id });
    if (!row) return CATEGORY_NOT_FOUND;
  } catch (error) {
    if (isUniqueViolation(error)) return NAME_TAKEN("Kategori");
    throw error;
  }

  revalidateProducts();
  return { success: true, data: undefined };
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const actor = await requireStore("product:manage");

  const id = categoryIdSchema.safeParse(categoryId);
  if (!id.success) return CATEGORY_NOT_FOUND;

  const [{ used }] = await db
    .select({ used: count() })
    .from(products)
    .where(and(eq(products.categoryId, id.data), eq(products.storeId, actor.storeId)));
  if (used > 0) {
    return { success: false, message: `Kategori masih dipakai ${used} barang. Pindahkan barangnya dulu.` };
  }

  const [row] = await db
    .delete(productCategories)
    .where(and(eq(productCategories.id, id.data), eq(productCategories.storeId, actor.storeId)))
    .returning({ id: productCategories.id });
  if (!row) return CATEGORY_NOT_FOUND;

  revalidateProducts();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Helper (tanpa export → bukan Server Action)
// ---------------------------------------------------------------------------

// Kategori dari toko lain tidak boleh dipakai walau id-nya ditebak.
async function categoryBelongsToStore(categoryId: string, storeId: string) {
  const [row] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(and(eq(productCategories.id, categoryId), eq(productCategories.storeId, storeId)))
    .limit(1);
  return !!row;
}

function invalid(error: z.ZodError) {
  return {
    success: false as const,
    message: "Periksa kembali isian Anda.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

// "layout" mencakup /products, /products/new, /products/categories, /products/[id].
function revalidateProducts() {
  revalidatePath("/products", "layout");
}
