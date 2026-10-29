// Pencatat mutasi stok. Dipakai oleh SEMUA fitur yang mengubah stok
// (products: stok awal; purchases; sales; stock-takes), karena itu letaknya
// di lib/, bukan di features/.
//
// Aturan (docs/BUSINESS-FLOW.md §8):
// - products.stock dan products.cost_price HANYA diubah lewat fungsi ini,
//   di dalam db.transaction() yang sama dengan dokumen pemicunya.
// - Baris stock_movements tidak pernah di-update/dihapus; koreksi = baris baru.
// - Baris barang dikunci (SELECT ... FOR UPDATE) selama transaksi, sehingga
//   dua kasir yang menjual barang yang sama bersamaan tidak saling menimpa stok.
//
// Referensi:
// - https://orm.drizzle.team/docs/transactions
// - https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS

import "server-only";
import { and, eq } from "drizzle-orm";
import type { db } from "@/lib/db";
import { products, stockMovements } from "@/lib/db/schema";

// Daftar jenis mutasi ada di lib/stock-types.ts (boleh dipakai di browser).
import type { StockMovementType } from "@/lib/stock-types";
export { STOCK_MOVEMENT_TYPES, type StockMovementType } from "@/lib/stock-types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type StockMovementInput = {
  storeId: string;
  productId: string;
  type: StockMovementType;
  qty: number; // bertanda: + masuk, − keluar
  // Harga modal baru (hasil rata-rata tertimbang). Kosong = tidak berubah.
  costPrice?: number;
  referenceTable?: "purchases" | "sales" | "stock_takes";
  referenceId?: string;
  note?: string;
  createdById: string;
};

export async function recordStockMovement(tx: Transaction, input: StockMovementInput) {
  const [product] = await tx
    .select({ stock: products.stock, costPrice: products.costPrice })
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.storeId, input.storeId)))
    .for("update");
  if (!product) throw new Error("Barang tidak ditemukan");

  const stockAfter = product.stock + input.qty;
  const costPrice = input.costPrice ?? product.costPrice;

  await tx.update(products).set({ stock: stockAfter, costPrice }).where(eq(products.id, input.productId));
  await tx.insert(stockMovements).values({
    storeId: input.storeId,
    productId: input.productId,
    type: input.type,
    qty: input.qty,
    stockAfter,
    costPrice,
    referenceTable: input.referenceTable ?? null,
    referenceId: input.referenceId ?? null,
    note: input.note ?? null,
    createdById: input.createdById,
  });

  return { stockAfter, costPrice };
}
