// Server Action pembelian / barang masuk (permission purchase:manage, Pemilik).
//
// Aturan (docs/BUSINESS-FLOW.md §4 & §8):
// - Simpan pembelian = satu db.transaction(): nomor BL-, dokumen, baris,
//   harga modal rata-rata tertimbang baru, mutasi stok PURCHASE, dan harga
//   jual baru bila diisi. Gagal satu = batal semua.
// - Pembelian tidak bisa diedit. Salah input = batalkan (VOIDED): mutasi
//   PURCHASE_VOID −qty dan harga modal dihitung ulang dari riwayat mutasi.
//   Ditolak bila stok akan minus (barangnya sudah terjual → stok opname).
//   Harga jual yang sempat diubah lewat pembelian TIDAK dikembalikan.
// - Baris barang dikunci (FOR UPDATE) urut id, agar dua penyimpanan bersamaan
//   tidak saling menimpa stok dan tidak saling menunggu (deadlock).

"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { calculateAverageCost, replayAverageCost, type CostReplayEntry } from "@/features/products/service";
import { requireStore } from "@/lib/auth/dal";
import { zonedDateString } from "@/lib/dates";
import { db } from "@/lib/db";
import { products, purchaseItems, purchases, stockMovements } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/document-number";
import { recordStockMovement } from "@/lib/stock";
import type { ActionResult } from "@/types/action-result";
import { purchaseSchema, voidPurchaseSchema } from "./schemas";
import { calculatePurchaseTotal, canVoidPurchaseItem, periodOfDate } from "./service";

const NOT_FOUND = { success: false, message: "Pembelian tidak ditemukan." } as const;

// Pelanggaran aturan bisnis di tengah transaksi: dilempar agar transaksi
// di-rollback, lalu diubah menjadi pesan untuk user.
class PurchaseRuleError extends Error {}

export async function createPurchase(
  _prevState: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requireStore("purchase:manage");

  const parsed = purchaseSchema.safeParse({
    date: formData.get("date"),
    note: formData.get("note") ?? "",
    items: parseJson(formData.get("items")),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { date, note, items } = parsed.data;
  if (date > zonedDateString(new Date())) {
    return { success: false, message: "Periksa kembali isian Anda.", fieldErrors: { date: ["Tanggal tidak boleh di masa depan"] } };
  }

  try {
    const id = await db.transaction(async (tx) => {
      const productIds = items.map((item) => item.productId).sort();
      const locked = await tx
        .select({
          id: products.id,
          name: products.name,
          stock: products.stock,
          costPrice: products.costPrice,
          isActive: products.isActive,
        })
        .from(products)
        .where(and(eq(products.storeId, actor.storeId), inArray(products.id, productIds)))
        .orderBy(asc(products.id))
        .for("update");
      const byId = new Map(locked.map((product) => [product.id, product]));

      for (const item of items) {
        const product = byId.get(item.productId);
        // Barang toko lain (id ditebak) = tidak ditemukan.
        if (!product) throw new PurchaseRuleError("Ada barang yang tidak ditemukan. Muat ulang halaman.");
        if (!product.isActive) throw new PurchaseRuleError(`${product.name} sudah nonaktif dan tidak bisa dibeli.`);
      }

      const { year, month } = periodOfDate(date);
      const number = await nextDocumentNumber(tx, { storeId: actor.storeId, prefix: "BL", year, month });
      const [purchase] = await tx
        .insert(purchases)
        .values({
          storeId: actor.storeId,
          number,
          periodYear: year,
          periodMonth: month,
          date,
          note,
          total: calculatePurchaseTotal(items),
          createdById: actor.id,
        })
        .returning({ id: purchases.id });

      for (const item of items) {
        const product = byId.get(item.productId)!;
        const costPriceAfter = calculateAverageCost(product.stock, product.costPrice, item.qty, item.unitCost);

        await tx.insert(purchaseItems).values({
          storeId: actor.storeId,
          purchaseId: purchase.id,
          productId: product.id,
          productName: product.name,
          qty: item.qty,
          unitCost: item.unitCost,
          subtotal: item.qty * item.unitCost,
          costPriceBefore: product.costPrice,
          costPriceAfter,
          newSellingPrice: item.newSellingPrice,
        });
        await recordStockMovement(tx, {
          storeId: actor.storeId,
          productId: product.id,
          type: "PURCHASE",
          qty: item.qty,
          costPrice: costPriceAfter,
          referenceTable: "purchases",
          referenceId: purchase.id,
          note: number,
          createdById: actor.id,
        });
        if (item.newSellingPrice !== null) {
          await tx.update(products).set({ sellingPrice: item.newSellingPrice }).where(eq(products.id, product.id));
        }
      }

      return purchase.id;
    });

    revalidatePurchases();
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof PurchaseRuleError) return { success: false, message: error.message };
    throw error;
  }
}

// Dipanggil dari event handler (dialog pembatalan); argumen divalidasi ulang dengan zod.
export async function voidPurchase(purchaseId: string, reason: string): Promise<ActionResult> {
  const actor = await requireStore("purchase:manage");

  const parsed = voidPurchaseSchema.safeParse({ purchaseId, reason });
  if (!parsed.success) {
    return { success: false, message: z.flattenError(parsed.error).fieldErrors.reason?.[0] ?? NOT_FOUND.message };
  }

  try {
    await db.transaction(async (tx) => {
      // Hanya pembelian COMPLETED milik toko ini; sekaligus mengunci barisnya
      // sehingga dua klik "Batalkan" bersamaan tidak memproses dua kali.
      const [purchase] = await tx
        .update(purchases)
        .set({ status: "VOIDED", voidReason: parsed.data.reason, voidedById: actor.id, voidedAt: new Date() })
        .where(
          and(
            eq(purchases.id, parsed.data.purchaseId),
            eq(purchases.storeId, actor.storeId),
            eq(purchases.status, "COMPLETED"),
          ),
        )
        .returning({ id: purchases.id, number: purchases.number });
      if (!purchase) throw new PurchaseRuleError("Pembelian tidak ditemukan atau sudah dibatalkan.");

      const items = await tx
        .select({ productId: purchaseItems.productId, productName: purchaseItems.productName, qty: purchaseItems.qty })
        .from(purchaseItems)
        .where(eq(purchaseItems.purchaseId, purchase.id))
        .orderBy(asc(purchaseItems.productId));

      for (const item of items) {
        const [product] = await tx
          .select({ stock: products.stock })
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.storeId, actor.storeId)))
          .for("update");
        if (!product || !canVoidPurchaseItem(product.stock, item.qty)) {
          throw new PurchaseRuleError(
            `${item.productName} dari pembelian ini sudah terjual, buat penyesuaian lewat stok opname.`,
          );
        }

        // Pembelian ini sudah VOIDED di transaksi yang sama, jadi ikut terlewati.
        const costPrice = replayAverageCost(await costReplayEntries(tx, actor.storeId, item.productId));
        await recordStockMovement(tx, {
          storeId: actor.storeId,
          productId: item.productId,
          type: "PURCHASE_VOID",
          qty: -item.qty,
          costPrice,
          referenceTable: "purchases",
          referenceId: purchase.id,
          note: `${purchase.number} dibatalkan`,
          createdById: actor.id,
        });
      }
    });
  } catch (error) {
    if (error instanceof PurchaseRuleError) return { success: false, message: error.message };
    throw error;
  }

  revalidatePurchases();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Helper (tanpa export → bukan Server Action)
// ---------------------------------------------------------------------------

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Riwayat mutasi satu barang urut waktu, dalam bentuk yang dibaca
// replayAverageCost(): stok awal & pembelian yang masih berlaku membentuk
// harga modal; pembelian yang dibatalkan beserta mutasi PURCHASE_VOID-nya
// dilewati (saling meniadakan); penjualan & opname hanya mengubah stok.
async function costReplayEntries(tx: Transaction, storeId: string, productId: string): Promise<CostReplayEntry[]> {
  const rows = await tx
    .select({
      type: stockMovements.type,
      qty: stockMovements.qty,
      costPrice: stockMovements.costPrice,
      unitCost: purchaseItems.unitCost,
      purchaseStatus: purchases.status,
    })
    .from(stockMovements)
    .leftJoin(
      purchaseItems,
      and(eq(purchaseItems.purchaseId, stockMovements.referenceId), eq(purchaseItems.productId, stockMovements.productId)),
    )
    .leftJoin(purchases, eq(purchases.id, purchaseItems.purchaseId))
    .where(and(eq(stockMovements.storeId, storeId), eq(stockMovements.productId, productId)))
    .orderBy(asc(stockMovements.createdAt));

  return rows.flatMap((row): CostReplayEntry[] => {
    switch (row.type) {
      case "INITIAL":
        return [{ qty: row.qty, unitCost: row.costPrice }];
      case "PURCHASE":
        return row.purchaseStatus === "COMPLETED" && row.unitCost !== null ? [{ qty: row.qty, unitCost: row.unitCost }] : [];
      case "PURCHASE_VOID":
        return [];
      default:
        return [{ qty: row.qty, unitCost: null }];
    }
  });
}

// Isian baris dikirim sebagai JSON di satu field form; JSON rusak → array
// kosong sehingga zod memberi pesan "Tambahkan minimal satu barang".
function parseJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

// Error per baris memakai path lengkap ("items.0.qty") agar form bisa
// menampilkannya di baris yang tepat.
function invalid(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { success: false as const, message: "Periksa kembali isian Anda.", fieldErrors };
}

// Pembelian mengubah stok & harga barang, jadi halaman barang ikut diperbarui.
function revalidatePurchases() {
  revalidatePath("/purchases", "layout");
  revalidatePath("/products", "layout");
}
