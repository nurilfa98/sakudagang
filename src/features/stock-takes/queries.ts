// Query database untuk stok opname (Pemilik, stock-take:manage). Semua fungsi
// menerima storeId dari requireStore() dan SELALU memfilternya.
//
// Selama DRAFT, "stok sistem" yang ditampilkan adalah products.stock TERKINI
// (bukan snapshot saat draf dibuat), karena itulah yang dipakai saat opname
// diselesaikan. Setelah COMPLETED, angka yang tampil adalah snapshot final.
//
// Penjelasan `await io()` ada di features/stores/queries.ts.

import "server-only";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { io } from "next/cache";
import { formatDateOnly, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { productCategories, products, stockTakeItems, stockTakes, users } from "@/lib/db/schema";
import type { StockTakeReason, StockTakeStatus } from "./constants";

export type StockTakeListItem = {
  id: string;
  number: string;
  dateLabel: string;
  status: StockTakeStatus;
  itemCount: number;
  countedCount: number;
  totalShrinkage: number | null;
  createdByName: string;
};

export type StockTakeItemDetail = {
  productId: string;
  productName: string;
  categoryName: string;
  unit: string;
  systemQty: number; // DRAFT: stok terkini; COMPLETED: snapshot final
  physicalQty: number | null;
  difference: number | null; // hanya COMPLETED
  reason: StockTakeReason | null;
  note: string | null;
  costPrice: number; // DRAFT: harga modal terkini; COMPLETED: snapshot
  shrinkageValue: number | null; // hanya COMPLETED
};

export type StockTakeDetail = {
  id: string;
  number: string;
  date: string;
  dateLabel: string;
  status: StockTakeStatus;
  note: string | null;
  totalShrinkage: number | null;
  createdByName: string;
  createdAtLabel: string;
  completedByName: string | null;
  completedAtLabel: string | null;
  items: StockTakeItemDetail[];
};

export async function listStockTakes(storeId: string): Promise<StockTakeListItem[]> {
  await io();
  const rows = await db
    .select({
      id: stockTakes.id,
      number: stockTakes.number,
      date: stockTakes.date,
      status: stockTakes.status,
      itemCount: count(stockTakeItems.id),
      countedCount: count(stockTakeItems.physicalQty),
      totalShrinkage: stockTakes.totalShrinkage,
      createdByName: users.fullName,
    })
    .from(stockTakes)
    .innerJoin(users, eq(stockTakes.createdById, users.id))
    .leftJoin(stockTakeItems, eq(stockTakeItems.stockTakeId, stockTakes.id))
    .where(eq(stockTakes.storeId, storeId))
    .groupBy(stockTakes.id, users.fullName)
    .orderBy(desc(stockTakes.createdAt))
    .limit(200);

  return rows.map(({ date, ...row }) => ({
    ...row,
    status: row.status as StockTakeStatus,
    dateLabel: formatDateOnly(date),
  }));
}

// Opname DRAFT toko ini (paling banyak satu), untuk tombol "Lanjutkan".
export async function findDraftStockTake(storeId: string) {
  await io();
  const [row] = await db
    .select({ id: stockTakes.id, number: stockTakes.number })
    .from(stockTakes)
    .where(and(eq(stockTakes.storeId, storeId), eq(stockTakes.status, "DRAFT")))
    .limit(1);
  return row ?? null;
}

const completedBy = alias(users, "completed_by");

export async function getStockTake(storeId: string, id: string): Promise<StockTakeDetail | null> {
  await io();
  const [row] = await db
    .select({
      id: stockTakes.id,
      number: stockTakes.number,
      date: stockTakes.date,
      status: stockTakes.status,
      note: stockTakes.note,
      totalShrinkage: stockTakes.totalShrinkage,
      createdByName: users.fullName,
      createdAt: stockTakes.createdAt,
      completedByName: completedBy.fullName,
      completedAt: stockTakes.completedAt,
    })
    .from(stockTakes)
    .innerJoin(users, eq(stockTakes.createdById, users.id))
    .leftJoin(completedBy, eq(stockTakes.completedById, completedBy.id))
    .where(and(eq(stockTakes.id, id), eq(stockTakes.storeId, storeId)))
    .limit(1);
  if (!row) return null;

  const draft = row.status === "DRAFT";
  const items = await db
    .select({
      productId: stockTakeItems.productId,
      productName: stockTakeItems.productName,
      categoryName: productCategories.name,
      unit: products.unit,
      snapshotQty: stockTakeItems.systemQty,
      currentStock: products.stock,
      physicalQty: stockTakeItems.physicalQty,
      difference: stockTakeItems.difference,
      reason: stockTakeItems.reason,
      note: stockTakeItems.note,
      snapshotCost: stockTakeItems.costPrice,
      currentCost: products.costPrice,
      shrinkageValue: stockTakeItems.shrinkageValue,
    })
    .from(stockTakeItems)
    .innerJoin(products, eq(stockTakeItems.productId, products.id))
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(and(eq(stockTakeItems.stockTakeId, row.id), eq(stockTakeItems.storeId, storeId)))
    .orderBy(asc(productCategories.sortOrder), asc(stockTakeItems.productName));

  const { createdAt, completedAt, ...rest } = row;
  return {
    ...rest,
    status: row.status as StockTakeStatus,
    dateLabel: formatDateOnly(row.date),
    createdAtLabel: formatDateTime(createdAt),
    completedAtLabel: completedAt ? formatDateTime(completedAt) : null,
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      categoryName: item.categoryName,
      unit: item.unit,
      systemQty: draft ? item.currentStock : item.snapshotQty,
      physicalQty: item.physicalQty,
      difference: item.difference,
      reason: item.reason as StockTakeReason | null,
      note: item.note,
      costPrice: draft ? item.currentCost : (item.snapshotCost ?? 0),
      shrinkageValue: item.shrinkageValue,
    })),
  };
}

