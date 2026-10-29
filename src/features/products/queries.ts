// Query database untuk halaman Barang. Semua fungsi menerima storeId dari
// requireStore() dan SELALU memfilternya (multi-tenant).
//
// Harga modal hanya dikembalikan bila `withCost` true (permission
// product:view-cost); untuk Kasir nilainya null, bukan sekadar disembunyikan di UI.
//
// Penjelasan `await io()` ada di features/stores/queries.ts.

import "server-only";
import { and, asc, count, desc, eq, gte, isNotNull, lt, lte, or } from "drizzle-orm";
import { io } from "next/cache";
import { formatDateTime, zonedPeriodRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { productCategories, products, stockMovements, users } from "@/lib/db/schema";
import type { StockMovementType } from "@/lib/stock-types";
import type { ProductFilters, StockMovementFilters } from "./schemas";

// Data table memproses pencarian, urutan, dan halaman di browser, jadi
// jumlah baris per query dibatasi (docs/ARCHITECTURE.md §3).
export const LIST_LIMIT = 500;

export type ProductListItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  costPrice: number | null;
  sellingPrice: number;
  stock: number;
  minStock: number | null;
  isActive: boolean;
};

export type ProductDetail = ProductListItem & { createdAt: Date };

export type CategoryItem = { id: string; name: string; sortOrder: number; productCount: number };

export type StockMovementItem = {
  id: string;
  type: StockMovementType;
  qty: number;
  stockAfter: number;
  costPrice: number | null;
  note: string | null;
  createdByName: string;
  createdAtLabel: string;
  createdAtTime: number; // untuk mengurutkan di data table
};

const productColumns = {
  id: products.id,
  name: products.name,
  categoryId: products.categoryId,
  categoryName: productCategories.name,
  unit: products.unit,
  costPrice: products.costPrice,
  sellingPrice: products.sellingPrice,
  stock: products.stock,
  minStock: products.minStock,
  isActive: products.isActive,
};

// Filter (kategori, status, stok menipis) diterapkan di SQL; pencarian nama
// berjalan di browser (components/data-table).
export async function listProducts(
  storeId: string,
  { withCost, categoryId, status, stock, limit = LIST_LIMIT }: { withCost: boolean; limit?: number } & ProductFilters,
): Promise<ProductListItem[]> {
  await io();
  const rows = await db
    .select(productColumns)
    .from(products)
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(
      and(
        eq(products.storeId, storeId),
        categoryId ? eq(products.categoryId, categoryId) : undefined,
        status ? eq(products.isActive, status === "ACTIVE") : undefined,
        // Perlu restock: stok minus, atau ≤ stok minimum bila dipantau.
        stock === "LOW"
          ? or(lt(products.stock, 0), and(isNotNull(products.minStock), lte(products.stock, products.minStock)))
          : undefined,
      ),
    )
    .orderBy(asc(products.name))
    .limit(limit);

  return rows.map((row) => ({ ...row, costPrice: withCost ? row.costPrice : null }));
}

export async function getProduct(
  storeId: string,
  id: string,
  { withCost }: { withCost: boolean },
): Promise<ProductDetail | null> {
  await io();
  const [row] = await db
    .select({ ...productColumns, createdAt: products.createdAt })
    .from(products)
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(and(eq(products.id, id), eq(products.storeId, storeId)))
    .limit(1);

  if (!row) return null;
  return { ...row, costPrice: withCost ? row.costPrice : null };
}

export async function listCategories(storeId: string): Promise<CategoryItem[]> {
  await io();
  return db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      sortOrder: productCategories.sortOrder,
      productCount: count(products.id),
    })
    .from(productCategories)
    .leftJoin(products, eq(products.categoryId, productCategories.id))
    .where(eq(productCategories.storeId, storeId))
    .groupBy(productCategories.id)
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
}

// Riwayat mutasi satu barang, terbaru dulu. Tanggal diformat di server (zona
// waktu aplikasi; zona per toko menyusul saat lib/dates.ts di-refactor).
// Filter jenis & periode (tahun/bulan) diterapkan di SQL.
export async function listStockMovements(
  storeId: string,
  productId: string,
  { withCost, type, year, month, limit = LIST_LIMIT }: { withCost: boolean; limit?: number } & StockMovementFilters,
): Promise<StockMovementItem[]> {
  await io();
  const period = year ? zonedPeriodRange(year, month) : null;
  const rows = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      qty: stockMovements.qty,
      stockAfter: stockMovements.stockAfter,
      costPrice: stockMovements.costPrice,
      note: stockMovements.note,
      createdByName: users.fullName,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(users, eq(stockMovements.createdById, users.id))
    .where(
      and(
        eq(stockMovements.storeId, storeId),
        eq(stockMovements.productId, productId),
        type ? eq(stockMovements.type, type) : undefined,
        period ? gte(stockMovements.createdAt, period.start) : undefined,
        period ? lt(stockMovements.createdAt, period.end) : undefined,
      ),
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);

  return rows.map(({ createdAt, ...row }) => ({
    ...row,
    type: row.type as StockMovementType,
    costPrice: withCost ? row.costPrice : null,
    createdAtLabel: formatDateTime(createdAt),
    createdAtTime: createdAt.getTime(),
  }));
}
