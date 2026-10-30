// Query database untuk kasir & riwayat penjualan. Semua fungsi menerima
// storeId dari requireStore() dan SELALU memfilternya (multi-tenant).
//
// Harga modal & laba hanya dikembalikan bila `withCost` true (permission
// product:view-cost); untuk Kasir nilainya null, bukan sekadar disembunyikan
// di UI (docs/ARCHITECTURE.md §3 "DTO").
//
// Penjelasan `await io()` ada di features/stores/queries.ts.

import "server-only";
import { and, asc, count, desc, eq, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { io } from "next/cache";
import { formatDateOnly, formatDateTime, formatTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { customers, productCategories, products, saleItems, sales, users } from "@/lib/db/schema";
import type { PaymentMethod, SalePaymentStatus, SaleStatus } from "./constants";
import type { SaleFilters } from "./schemas";

// Pencarian, urutan, dan halaman berjalan di browser (docs/ARCHITECTURE.md §3).
const LIST_LIMIT = 500;

// Barang di layar kasir: TANPA harga modal, untuk siapa pun yang membuka
// kasir. Harga modal dibaca server sendiri saat transaksi disimpan.
export type CashierProduct = {
  id: string;
  name: string;
  categoryName: string;
  unit: string;
  sellingPrice: number;
  stock: number;
};

export type SaleListItem = {
  id: string;
  number: string;
  timeLabel: string;
  createdAtTime: number; // untuk mengurutkan
  paymentMethod: PaymentMethod;
  paymentStatus: SalePaymentStatus;
  status: SaleStatus;
  customerName: string | null;
  total: number;
  grossProfit: number | null;
  itemCount: number;
  createdByName: string;
};

export type SaleItemDetail = {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  qty: number;
  sellingPrice: number;
  subtotal: number;
  costPrice: number | null;
  grossProfit: number | null;
};

export type SaleDetail = {
  id: string;
  number: string;
  date: string;
  dateLabel: string;
  createdAtLabel: string;
  paymentMethod: PaymentMethod;
  paymentStatus: SalePaymentStatus;
  status: SaleStatus;
  customerId: string | null;
  customerName: string | null;
  total: number;
  totalCost: number | null;
  totalGrossProfit: number | null;
  cashReceived: number | null;
  createdById: string;
  createdByName: string;
  voidReason: string | null;
  voidedByName: string | null;
  voidedAtLabel: string | null;
  items: SaleItemDetail[];
};

export async function listCashierProducts(storeId: string): Promise<CashierProduct[]> {
  await io();
  return db
    .select({
      id: products.id,
      name: products.name,
      categoryName: productCategories.name,
      unit: products.unit,
      sellingPrice: products.sellingPrice,
      stock: products.stock,
    })
    .from(products)
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(and(eq(products.storeId, storeId), eq(products.isActive, true)))
    .orderBy(asc(products.name));
}

// Penjualan satu hari. `createdById` diisi untuk Kasir: ia hanya melihat
// transaksinya sendiri (yang boleh ia batalkan).
export async function listSales(
  storeId: string,
  {
    date,
    paymentMethod,
    status,
    createdById,
    withCost,
    limit = LIST_LIMIT,
  }: Omit<SaleFilters, "date"> & { date: string; createdById?: string; withCost: boolean; limit?: number },
): Promise<SaleListItem[]> {
  await io();
  const rows = await db
    .select({
      id: sales.id,
      number: sales.number,
      createdAt: sales.createdAt,
      paymentMethod: sales.paymentMethod,
      paymentStatus: sales.paymentStatus,
      status: sales.status,
      customerName: customers.name,
      total: sales.total,
      grossProfit: sales.totalGrossProfit,
      itemCount: count(saleItems.id),
      createdByName: users.fullName,
    })
    .from(sales)
    .innerJoin(users, eq(sales.createdById, users.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
    .where(
      and(
        eq(sales.storeId, storeId),
        eq(sales.date, date),
        paymentMethod ? eq(sales.paymentMethod, paymentMethod) : undefined,
        status ? eq(sales.status, status) : undefined,
        createdById ? eq(sales.createdById, createdById) : undefined,
      ),
    )
    .groupBy(sales.id, users.fullName, customers.name)
    .orderBy(desc(sales.createdAt))
    .limit(limit);

  return rows.map(({ createdAt, ...row }) => ({
    ...row,
    paymentMethod: row.paymentMethod as PaymentMethod,
    paymentStatus: row.paymentStatus as SalePaymentStatus,
    status: row.status as SaleStatus,
    grossProfit: withCost ? row.grossProfit : null,
    timeLabel: formatTime(createdAt),
    createdAtTime: createdAt.getTime(),
  }));
}

// Tabel users kedua (yang membatalkan); alias wajib agar tidak bentrok dengan join pencatat.
const voidedBy = alias(users, "voided_by");

export async function getSale(
  storeId: string,
  id: string,
  { withCost, createdById }: { withCost: boolean; createdById?: string },
): Promise<SaleDetail | null> {
  await io();
  const [row] = await db
    .select({
      id: sales.id,
      number: sales.number,
      date: sales.date,
      createdAt: sales.createdAt,
      paymentMethod: sales.paymentMethod,
      paymentStatus: sales.paymentStatus,
      status: sales.status,
      customerId: sales.customerId,
      customerName: customers.name,
      total: sales.total,
      totalCost: sales.totalCost,
      totalGrossProfit: sales.totalGrossProfit,
      cashReceived: sales.cashReceived,
      createdById: sales.createdById,
      createdByName: users.fullName,
      voidReason: sales.voidReason,
      voidedByName: voidedBy.fullName,
      voidedAt: sales.voidedAt,
    })
    .from(sales)
    .innerJoin(users, eq(sales.createdById, users.id))
    .leftJoin(voidedBy, eq(sales.voidedById, voidedBy.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(
      and(eq(sales.id, id), eq(sales.storeId, storeId), createdById ? eq(sales.createdById, createdById) : undefined),
    )
    .limit(1);
  if (!row) return null;

  const items = await db
    .select({
      id: saleItems.id,
      productId: saleItems.productId,
      productName: saleItems.productName,
      unit: products.unit,
      qty: saleItems.qty,
      sellingPrice: saleItems.sellingPrice,
      subtotal: saleItems.subtotal,
      costPrice: saleItems.costPrice,
      grossProfit: saleItems.grossProfit,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(and(eq(saleItems.saleId, row.id), eq(saleItems.storeId, storeId)))
    .orderBy(asc(saleItems.productName));

  const { createdAt, voidedAt, ...rest } = row;
  return {
    ...rest,
    paymentMethod: row.paymentMethod as PaymentMethod,
    paymentStatus: row.paymentStatus as SalePaymentStatus,
    status: row.status as SaleStatus,
    totalCost: withCost ? row.totalCost : null,
    totalGrossProfit: withCost ? row.totalGrossProfit : null,
    dateLabel: formatDateOnly(row.date),
    createdAtLabel: formatDateTime(createdAt),
    voidedAtLabel: voidedAt ? formatDateTime(voidedAt) : null,
    items: items.map((item) => ({
      ...item,
      costPrice: withCost ? item.costPrice : null,
      grossProfit: withCost ? item.grossProfit : null,
    })),
  };
}

// Ringkasan "transaksi saya hari ini" untuk beranda Kasir (BUSINESS-FLOW §10.5).
export async function summarizeMySales(storeId: string, userId: string, date: string) {
  await io();
  const [row] = await db
    .select({ count: count(sales.id), total: sum(sales.total).mapWith(Number) })
    .from(sales)
    .where(
      and(
        eq(sales.storeId, storeId),
        eq(sales.createdById, userId),
        eq(sales.date, date),
        eq(sales.status, "COMPLETED"),
      ),
    );
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}
