// Query database untuk halaman Pembelian. Semua fungsi menerima storeId dari
// requireStore("purchase:manage") dan SELALU memfilternya (multi-tenant).
// Pembelian hanya untuk Pemilik, jadi harga modal boleh ikut dikembalikan.
//
// Penjelasan `await io()` ada di features/stores/queries.ts.

import "server-only";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { io } from "next/cache";
import { formatDateOnly, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { products, purchaseItems, purchases, users } from "@/lib/db/schema";
import type { PurchaseStatus } from "./constants";
import type { PurchaseFilters } from "./schemas";

// Pencarian, urutan, dan halaman berjalan di browser (docs/ARCHITECTURE.md §3).
const LIST_LIMIT = 500;

export type PurchaseListItem = {
  id: string;
  number: string;
  date: string; // "2026-10-24", untuk mengurutkan
  dateLabel: string;
  note: string | null;
  total: number;
  status: PurchaseStatus;
  itemCount: number;
  createdByName: string;
};

export type PurchaseItemDetail = {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  qty: number;
  unitCost: number;
  subtotal: number;
  costPriceBefore: number;
  costPriceAfter: number;
  newSellingPrice: number | null;
};

export type PurchaseDetail = Omit<PurchaseListItem, "itemCount"> & {
  createdAtLabel: string;
  voidReason: string | null;
  voidedByName: string | null;
  voidedAtLabel: string | null;
  items: PurchaseItemDetail[];
};

// Pilihan barang di form pembelian: barang aktif beserta stok & harga modal
// saat ini, untuk pratinjau harga modal rata-rata baru.
export type PurchasableProduct = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
};

export async function listPurchases(
  storeId: string,
  { status, year, month, limit = LIST_LIMIT }: PurchaseFilters & { limit?: number },
): Promise<PurchaseListItem[]> {
  await io();
  const rows = await db
    .select({
      id: purchases.id,
      number: purchases.number,
      date: purchases.date,
      note: purchases.note,
      total: purchases.total,
      status: purchases.status,
      itemCount: count(purchaseItems.id),
      createdByName: users.fullName,
    })
    .from(purchases)
    .innerJoin(users, eq(purchases.createdById, users.id))
    .leftJoin(purchaseItems, eq(purchaseItems.purchaseId, purchases.id))
    .where(
      and(
        eq(purchases.storeId, storeId),
        status ? eq(purchases.status, status) : undefined,
        year ? eq(purchases.periodYear, year) : undefined,
        month ? eq(purchases.periodMonth, month) : undefined,
      ),
    )
    .groupBy(purchases.id, users.fullName)
    .orderBy(desc(purchases.date), desc(purchases.createdAt))
    .limit(limit);

  return rows.map((row) => ({ ...row, status: row.status as PurchaseStatus, dateLabel: formatDateOnly(row.date) }));
}

// Tabel users kedua (yang membatalkan); alias wajib agar tidak bentrok dengan join pembuat.
const voidedBy = alias(users, "voided_by");

export async function getPurchase(storeId: string, id: string): Promise<PurchaseDetail | null> {
  await io();
  const [row] = await db
    .select({
      id: purchases.id,
      number: purchases.number,
      date: purchases.date,
      note: purchases.note,
      total: purchases.total,
      status: purchases.status,
      createdByName: users.fullName,
      createdAt: purchases.createdAt,
      voidReason: purchases.voidReason,
      voidedByName: voidedBy.fullName,
      voidedAt: purchases.voidedAt,
    })
    .from(purchases)
    .innerJoin(users, eq(purchases.createdById, users.id))
    .leftJoin(voidedBy, eq(purchases.voidedById, voidedBy.id))
    .where(and(eq(purchases.id, id), eq(purchases.storeId, storeId)))
    .limit(1);
  if (!row) return null;

  const items = await db
    .select({
      id: purchaseItems.id,
      productId: purchaseItems.productId,
      productName: purchaseItems.productName,
      unit: products.unit,
      qty: purchaseItems.qty,
      unitCost: purchaseItems.unitCost,
      subtotal: purchaseItems.subtotal,
      costPriceBefore: purchaseItems.costPriceBefore,
      costPriceAfter: purchaseItems.costPriceAfter,
      newSellingPrice: purchaseItems.newSellingPrice,
    })
    .from(purchaseItems)
    .innerJoin(products, eq(purchaseItems.productId, products.id))
    .where(and(eq(purchaseItems.purchaseId, row.id), eq(purchaseItems.storeId, storeId)))
    .orderBy(asc(purchaseItems.productName));

  const { createdAt, voidedAt, ...rest } = row;
  return {
    ...rest,
    status: row.status as PurchaseStatus,
    dateLabel: formatDateOnly(row.date),
    createdAtLabel: formatDateTime(createdAt),
    voidedAtLabel: voidedAt ? formatDateTime(voidedAt) : null,
    items,
  };
}

// Tahun yang punya pembelian, terbaru dulu, untuk filter Tahun.
export async function listPurchaseYears(storeId: string): Promise<number[]> {
  await io();
  const rows = await db
    .selectDistinct({ year: purchases.periodYear })
    .from(purchases)
    .where(eq(purchases.storeId, storeId))
    .orderBy(desc(purchases.periodYear));
  return rows.map((row) => row.year);
}

export async function listPurchasableProducts(storeId: string): Promise<PurchasableProduct[]> {
  await io();
  return db
    .select({
      id: products.id,
      name: products.name,
      unit: products.unit,
      stock: products.stock,
      costPrice: products.costPrice,
      sellingPrice: products.sellingPrice,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.isActive, true)))
    .orderBy(asc(products.name));
}
