// Server Action pengeluaran operasional & kategorinya (permission
// expense:manage, Pemilik) — BUSINESS-FLOW §7.
//
// Pengeluaran bukan transaksi stok, jadi boleh diedit & dihapus (hard delete)
// tanpa efek berantai. Belanja stok BUKAN pengeluaran (dicatat di Pembelian).
// Kategori hanya bisa dihapus bila tidak dipakai pengeluaran mana pun.

"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStore } from "@/lib/auth/dal";
import { zonedDateString } from "@/lib/dates";
import { db, isUniqueViolation } from "@/lib/db";
import { expenseCategories, expenses } from "@/lib/db/schema";
import type { ActionResult } from "@/types/action-result";
import { expenseCategorySchema, expenseIdSchema, expenseSchema } from "./schemas";

const NOT_FOUND = { success: false, message: "Pengeluaran tidak ditemukan." } as const;
const CATEGORY_NOT_FOUND = { success: false, message: "Kategori tidak ditemukan." } as const;
const NAME_TAKEN = {
  success: false as const,
  message: "Periksa kembali isian Anda.",
  fieldErrors: { name: ["Kategori dengan nama ini sudah ada"] },
};

// ---------------------------------------------------------------------------
// Pengeluaran
// ---------------------------------------------------------------------------

// Tambah (tanpa expenseId) atau ubah (dengan expenseId) dari dialog form.
export async function saveExpense(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await requireStore("expense:manage");

  const parsed = expenseSchema.safeParse({
    date: formData.get("date"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.date > zonedDateString(new Date())) {
    return { success: false, message: "Periksa kembali isian Anda.", fieldErrors: { date: ["Tanggal tidak boleh di masa depan"] } };
  }
  if (!(await categoryBelongsToStore(parsed.data.categoryId, actor.storeId))) return CATEGORY_NOT_FOUND;

  const rawId = formData.get("expenseId");
  if (rawId) {
    const expenseId = expenseIdSchema.safeParse(rawId);
    if (!expenseId.success) return NOT_FOUND;
    const [row] = await db
      .update(expenses)
      .set(parsed.data)
      .where(and(eq(expenses.id, expenseId.data), eq(expenses.storeId, actor.storeId)))
      .returning({ id: expenses.id });
    if (!row) return NOT_FOUND;
  } else {
    await db.insert(expenses).values({ ...parsed.data, storeId: actor.storeId, createdById: actor.id });
  }

  revalidateExpenses();
  return { success: true, data: undefined };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const actor = await requireStore("expense:manage");

  const id = expenseIdSchema.safeParse(expenseId);
  if (!id.success) return NOT_FOUND;

  const [row] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id.data), eq(expenses.storeId, actor.storeId)))
    .returning({ id: expenses.id });
  if (!row) return NOT_FOUND;

  revalidateExpenses();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Kategori (dipakai components/category-manager.tsx)
// ---------------------------------------------------------------------------

export async function createExpenseCategory(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireStore("expense:manage");

  const parsed = expenseCategorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return invalid(parsed.error);

  try {
    // Kategori baru di urutan paling bawah.
    const [{ last }] = await db
      .select({ last: count() })
      .from(expenseCategories)
      .where(eq(expenseCategories.storeId, actor.storeId));
    await db.insert(expenseCategories).values({ ...parsed.data, storeId: actor.storeId, sortOrder: last + 1 });
  } catch (error) {
    if (isUniqueViolation(error)) return NAME_TAKEN;
    throw error;
  }

  revalidateExpenses();
  return { success: true, data: undefined };
}

export async function renameExpenseCategory(categoryId: string, name: string): Promise<ActionResult> {
  const actor = await requireStore("expense:manage");

  const id = expenseIdSchema.safeParse(categoryId);
  if (!id.success) return CATEGORY_NOT_FOUND;
  const parsed = expenseCategorySchema.safeParse({ name });
  if (!parsed.success) return invalid(parsed.error);

  try {
    const [row] = await db
      .update(expenseCategories)
      .set(parsed.data)
      .where(and(eq(expenseCategories.id, id.data), eq(expenseCategories.storeId, actor.storeId)))
      .returning({ id: expenseCategories.id });
    if (!row) return CATEGORY_NOT_FOUND;
  } catch (error) {
    if (isUniqueViolation(error)) return NAME_TAKEN;
    throw error;
  }

  revalidateExpenses();
  return { success: true, data: undefined };
}

export async function deleteExpenseCategory(categoryId: string): Promise<ActionResult> {
  const actor = await requireStore("expense:manage");

  const id = expenseIdSchema.safeParse(categoryId);
  if (!id.success) return CATEGORY_NOT_FOUND;

  const [{ used }] = await db
    .select({ used: count() })
    .from(expenses)
    .where(and(eq(expenses.categoryId, id.data), eq(expenses.storeId, actor.storeId)));
  if (used > 0) {
    return { success: false, message: `Kategori masih dipakai ${used} pengeluaran. Pindahkan pengeluarannya dulu.` };
  }

  const [row] = await db
    .delete(expenseCategories)
    .where(and(eq(expenseCategories.id, id.data), eq(expenseCategories.storeId, actor.storeId)))
    .returning({ id: expenseCategories.id });
  if (!row) return CATEGORY_NOT_FOUND;

  revalidateExpenses();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Helper (tanpa export → bukan Server Action)
// ---------------------------------------------------------------------------

// Kategori dari toko lain tidak boleh dipakai walau id-nya ditebak.
async function categoryBelongsToStore(categoryId: string, storeId: string) {
  const [row] = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(and(eq(expenseCategories.id, categoryId), eq(expenseCategories.storeId, storeId)))
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

// "layout" mencakup /expenses dan /expenses/categories.
function revalidateExpenses() {
  revalidatePath("/expenses", "layout");
}
