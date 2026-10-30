// Server Action stok opname (permission stock-take:manage, Pemilik) —
// BUSINESS-FLOW §9.
//
// 1. Mulai: opname DRAFT + satu baris per barang aktif (stok saat itu).
//    Hanya satu DRAFT per toko (unique partial index).
// 2. Hitung: simpan stok fisik per barang bertahap (hanya baris yang berubah).
// 3. Selesaikan (satu db.transaction()): untuk setiap barang yang dihitung,
//    stok sistem DIAMBIL ULANG dari products.stock (penjualan tetap berjalan
//    selama opname), selisih dihitung ulang, mutasi STOCK_TAKE sebesar
//    selisih, stok = fisik, penyusutan = |selisih kurang| × harga modal.
//    Selisih ≠ 0 tanpa alasan → ditolak. Barang yang tidak dihitung tidak berubah.
// 4. COMPLETED tidak bisa diubah. Salah hitung = buat opname baru.
//    DRAFT boleh dihapus (belum mengubah stok).

"use server";

import { and, asc, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStore } from "@/lib/auth/dal";
import { zonedDateString } from "@/lib/dates";
import { db, isUniqueViolation } from "@/lib/db";
import { products, stockTakeItems, stockTakes } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/document-number";
import { recordStockMovement } from "@/lib/stock";
import type { ActionResult } from "@/types/action-result";
import { STOCK_TAKE_REASON_LABELS, type StockTakeReason } from "./constants";
import { saveStockTakeCountsSchema, stockTakeIdSchema, type StockTakeCountInput } from "./schemas";
import { itemsMissingReason, shrinkageValue, stockTakeDifference } from "./service";

const NOT_FOUND = { success: false, message: "Opname tidak ditemukan atau sudah selesai." } as const;

// Pelanggaran aturan bisnis di tengah transaksi: dilempar agar transaksi
// di-rollback, lalu diubah menjadi pesan untuk user.
class StockTakeRuleError extends Error {}

export async function startStockTake(): Promise<ActionResult<{ id: string }>> {
  const actor = await requireStore("stock-take:manage");

  try {
    const id = await db.transaction(async (tx) => {
      const date = zonedDateString(new Date());
      const [year, month] = date.split("-").map(Number);
      const number = await nextDocumentNumber(tx, { storeId: actor.storeId, prefix: "SO", year, month });
      const [stockTake] = await tx
        .insert(stockTakes)
        .values({ storeId: actor.storeId, number, date, createdById: actor.id })
        .returning({ id: stockTakes.id });

      const active = await tx
        .select({ id: products.id, name: products.name, stock: products.stock })
        .from(products)
        .where(and(eq(products.storeId, actor.storeId), eq(products.isActive, true)));
      if (active.length === 0) throw new StockTakeRuleError("Belum ada barang aktif untuk dihitung.");

      await tx.insert(stockTakeItems).values(
        active.map((product) => ({
          storeId: actor.storeId,
          stockTakeId: stockTake.id,
          productId: product.id,
          productName: product.name,
          systemQty: product.stock,
        })),
      );
      return stockTake.id;
    });

    revalidateStockTakes();
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof StockTakeRuleError) return { success: false, message: error.message };
    if (isUniqueViolation(error)) {
      return { success: false, message: "Masih ada opname yang sedang dihitung. Selesaikan atau hapus dulu." };
    }
    throw error;
  }
}

// Simpan hasil hitung (draf). Hanya baris yang dikirim yang diubah.
export async function saveStockTakeCounts(stockTakeId: string, items: StockTakeCountInput[]): Promise<ActionResult> {
  const actor = await requireStore("stock-take:manage");

  const parsed = saveStockTakeCountsSchema.safeParse({ stockTakeId, items });
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Isian tidak valid." };

  const saved = await db.transaction(async (tx) => {
    if (!(await lockDraft(tx, actor.storeId, parsed.data.stockTakeId))) return false;
    await writeCounts(tx, parsed.data.stockTakeId, parsed.data.items);
    return true;
  });
  if (!saved) return NOT_FOUND;

  revalidateStockTakes();
  return { success: true, data: undefined };
}

// Simpan baris yang belum tersimpan lalu selesaikan, dalam satu transaksi.
export async function completeStockTake(
  stockTakeId: string,
  items: StockTakeCountInput[],
): Promise<ActionResult<{ totalShrinkage: number; adjusted: number }>> {
  const actor = await requireStore("stock-take:manage");

  const parsed = saveStockTakeCountsSchema.safeParse({ stockTakeId, items });
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Isian tidak valid." };

  try {
    const result = await db.transaction(async (tx) => {
      const stockTake = await lockDraft(tx, actor.storeId, parsed.data.stockTakeId);
      if (!stockTake) throw new StockTakeRuleError(NOT_FOUND.message);
      await writeCounts(tx, stockTake.id, parsed.data.items);

      const counted = await tx
        .select({
          id: stockTakeItems.id,
          productId: stockTakeItems.productId,
          productName: stockTakeItems.productName,
          physicalQty: stockTakeItems.physicalQty,
          reason: stockTakeItems.reason,
        })
        .from(stockTakeItems)
        .where(and(eq(stockTakeItems.stockTakeId, stockTake.id), isNotNull(stockTakeItems.physicalQty)))
        .orderBy(asc(stockTakeItems.productId));
      if (counted.length === 0) throw new StockTakeRuleError("Belum ada barang yang dihitung.");

      // Stok sistem diambil ulang dari nilai terkini; baris barang dikunci
      // (urut id) agar penjualan bersamaan menunggu sampai opname selesai.
      const lines = [];
      for (const item of counted) {
        const [product] = await tx
          .select({ stock: products.stock, costPrice: products.costPrice })
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.storeId, actor.storeId)))
          .for("update");
        lines.push({ ...item, physicalQty: item.physicalQty!, systemQty: product.stock, costPrice: product.costPrice });
      }

      const missing = itemsMissingReason(lines);
      if (missing.length > 0) {
        const names = missing.slice(0, 3).map((item) => item.productName).join(", ");
        throw new StockTakeRuleError(
          `Isi alasan selisih untuk ${names}${missing.length > 3 ? ` dan ${missing.length - 3} barang lain` : ""}.`,
        );
      }

      let totalShrinkage = 0;
      let adjusted = 0;
      for (const line of lines) {
        const difference = stockTakeDifference(line.physicalQty, line.systemQty);
        const shrinkage = shrinkageValue(difference, line.costPrice);
        totalShrinkage += shrinkage;
        if (difference !== 0) {
          adjusted += 1;
          await recordStockMovement(tx, {
            storeId: actor.storeId,
            productId: line.productId,
            type: "STOCK_TAKE",
            qty: difference,
            referenceTable: "stock_takes",
            referenceId: stockTake.id,
            note: `${stockTake.number}: ${STOCK_TAKE_REASON_LABELS[line.reason as StockTakeReason]}`,
            createdById: actor.id,
          });
        }
        await tx
          .update(stockTakeItems)
          .set({ systemQty: line.systemQty, difference, costPrice: line.costPrice, shrinkageValue: shrinkage })
          .where(eq(stockTakeItems.id, line.id));
      }

      await tx
        .update(stockTakes)
        .set({
          status: "COMPLETED",
          date: zonedDateString(new Date()),
          totalShrinkage,
          completedById: actor.id,
          completedAt: new Date(),
        })
        .where(eq(stockTakes.id, stockTake.id));

      return { totalShrinkage, adjusted };
    });

    revalidateStockTakes();
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof StockTakeRuleError) return { success: false, message: error.message };
    throw error;
  }
}

// Hapus draf (belum mengubah stok apa pun).
export async function deleteStockTakeDraft(stockTakeId: string): Promise<ActionResult> {
  const actor = await requireStore("stock-take:manage");

  const id = stockTakeIdSchema.safeParse(stockTakeId);
  if (!id.success) return NOT_FOUND;

  const deleted = await db.transaction(async (tx) => {
    if (!(await lockDraft(tx, actor.storeId, id.data))) return false;
    await tx.delete(stockTakeItems).where(eq(stockTakeItems.stockTakeId, id.data));
    await tx.delete(stockTakes).where(eq(stockTakes.id, id.data));
    return true;
  });
  if (!deleted) return NOT_FOUND;

  revalidateStockTakes();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Helper (tanpa export → bukan Server Action)
// ---------------------------------------------------------------------------

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Opname DRAFT milik toko ini, dikunci selama transaksi; null bila tidak ada
// atau sudah selesai.
async function lockDraft(tx: Transaction, storeId: string, stockTakeId: string) {
  const [row] = await tx
    .select({ id: stockTakes.id, number: stockTakes.number })
    .from(stockTakes)
    .where(and(eq(stockTakes.id, stockTakeId), eq(stockTakes.storeId, storeId), eq(stockTakes.status, "DRAFT")))
    .for("update");
  return row ?? null;
}

// Alasan & catatan hanya disimpan bila barangnya dihitung.
async function writeCounts(
  tx: Transaction,
  stockTakeId: string,
  items: { productId: string; physicalQty: number | null; reason: StockTakeReason | null; note: string | null }[],
) {
  for (const item of items) {
    const counted = item.physicalQty !== null;
    await tx
      .update(stockTakeItems)
      .set({
        physicalQty: item.physicalQty,
        reason: counted ? item.reason : null,
        note: counted ? item.note : null,
      })
      .where(and(eq(stockTakeItems.stockTakeId, stockTakeId), eq(stockTakeItems.productId, item.productId)));
  }
}

// Opname mengubah stok barang (halaman barang ikut diperbarui).
function revalidateStockTakes() {
  revalidatePath("/stock-takes", "layout");
  revalidatePath("/products", "layout");
}
