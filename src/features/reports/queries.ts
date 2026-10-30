// Query agregat laporan (BUSINESS-FLOW §10, DATABASE-SCHEMA §8). Laporan
// tidak menyimpan angka; semuanya dihitung saat diminta dari tabel transaksi.
// Semua fungsi menerima storeId dari requireStore("report:view").
//
// Periode = rentang tanggal kalender [start, end) dalam teks "YYYY-MM-DD",
// dibandingkan dengan kolom `date` (tanggal menurut zona waktu toko).
// Yang dihitung: penjualan & pembelian COMPLETED, pelunasan COMPLETED,
// opname COMPLETED.
//
// SUM() di PostgreSQL mengembalikan string → .mapWith(Number) (ARCHITECTURE §5).
// Penjelasan `await io()` ada di features/stores/queries.ts.

import "server-only";
import { and, desc, eq, gte, isNotNull, lt, lte, or, sql, sum, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { io } from "next/cache";
import { db } from "@/lib/db";
import {
  creditPayments,
  expenses,
  productCategories,
  products,
  purchases,
  saleItems,
  sales,
  stockTakes,
} from "@/lib/db/schema";
import type { PeriodTotals } from "./service";

type Range = { start: string; end: string };

const within = (column: PgColumn, { start, end }: Range) => and(gte(column, start), lt(column, end));
const money = (value: SQL | PgColumn) => sql<number>`coalesce(sum(${value}), 0)`.mapWith(Number);
const moneyWhere = (value: PgColumn, condition: SQL) =>
  sql<number>`coalesce(sum(${value}) filter (where ${condition}), 0)`.mapWith(Number);

export async function getPeriodTotals(storeId: string, range: Range): Promise<PeriodTotals> {
  await io();
  const [salesRow, paymentsRow, expensesRow, shrinkageRow, purchasesRow] = await Promise.all([
    db
      .select({
        omset: money(sales.total),
        hpp: money(sales.totalCost),
        transactionCount: sql<number>`count(*)`.mapWith(Number),
        cashSales: moneyWhere(sales.total, sql`${sales.paymentMethod} = 'CASH'`),
        qrisSales: moneyWhere(sales.total, sql`${sales.paymentMethod} = 'QRIS'`),
        creditSales: moneyWhere(sales.total, sql`${sales.paymentMethod} = 'CREDIT'`),
      })
      .from(sales)
      .where(and(eq(sales.storeId, storeId), eq(sales.status, "COMPLETED"), within(sales.date, range))),
    db
      .select({
        cash: moneyWhere(creditPayments.amount, sql`${creditPayments.paymentMethod} = 'CASH'`),
        qris: moneyWhere(creditPayments.amount, sql`${creditPayments.paymentMethod} = 'QRIS'`),
      })
      .from(creditPayments)
      .where(
        and(
          eq(creditPayments.storeId, storeId),
          eq(creditPayments.status, "COMPLETED"),
          within(creditPayments.date, range),
        ),
      ),
    db
      .select({ amount: money(expenses.amount) })
      .from(expenses)
      .where(and(eq(expenses.storeId, storeId), within(expenses.date, range))),
    db
      .select({ amount: money(stockTakes.totalShrinkage) })
      .from(stockTakes)
      .where(and(eq(stockTakes.storeId, storeId), eq(stockTakes.status, "COMPLETED"), within(stockTakes.date, range))),
    db
      .select({ amount: money(purchases.total) })
      .from(purchases)
      .where(and(eq(purchases.storeId, storeId), eq(purchases.status, "COMPLETED"), within(purchases.date, range))),
  ]);

  return {
    omset: salesRow[0].omset,
    hpp: salesRow[0].hpp,
    transactionCount: salesRow[0].transactionCount,
    cashSales: salesRow[0].cashSales,
    qrisSales: salesRow[0].qrisSales,
    creditSales: salesRow[0].creditSales,
    creditPaymentsCash: paymentsRow[0].cash,
    creditPaymentsQris: paymentsRow[0].qris,
    expenses: expensesRow[0].amount,
    shrinkage: shrinkageRow[0].amount,
    purchases: purchasesRow[0].amount,
  };
}

// Angka per hari ("YYYY-MM-DD") atau per bulan ("YYYY-MM") untuk tabel &
// grafik; digabung dengan buildBreakdown() di service.ts.
export async function getBreakdownSources(storeId: string, range: Range, unit: "day" | "month") {
  await io();
  const keyOf = (column: PgColumn) =>
    unit === "day" ? sql<string>`${column}::text` : sql<string>`to_char(${column}, 'YYYY-MM')`;

  const salesKey = keyOf(sales.date);
  const expensesKey = keyOf(expenses.date);
  const shrinkageKey = keyOf(stockTakes.date);

  const [salesRows, expenseRows, shrinkageRows] = await Promise.all([
    db
      .select({ key: salesKey, omset: money(sales.total), hpp: money(sales.totalCost) })
      .from(sales)
      .where(and(eq(sales.storeId, storeId), eq(sales.status, "COMPLETED"), within(sales.date, range)))
      .groupBy(salesKey),
    db
      .select({ key: expensesKey, amount: money(expenses.amount) })
      .from(expenses)
      .where(and(eq(expenses.storeId, storeId), within(expenses.date, range)))
      .groupBy(expensesKey),
    db
      .select({ key: shrinkageKey, amount: money(stockTakes.totalShrinkage) })
      .from(stockTakes)
      .where(and(eq(stockTakes.storeId, storeId), eq(stockTakes.status, "COMPLETED"), within(stockTakes.date, range)))
      .groupBy(shrinkageKey),
  ]);

  return { sales: salesRows, expenses: expenseRows, shrinkage: shrinkageRows };
}

export type TopProduct = { productId: string; productName: string; qty: number; omset: number; grossProfit: number };

// Barang terlaris dalam periode (qty terbanyak), dengan laba kotornya.
export async function getTopProducts(storeId: string, range: Range, limit = 10): Promise<TopProduct[]> {
  await io();
  const qty = sql<number>`sum(${saleItems.qty})`.mapWith(Number);
  return db
    .select({
      productId: saleItems.productId,
      productName: saleItems.productName,
      qty,
      omset: money(saleItems.subtotal),
      grossProfit: money(saleItems.grossProfit),
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(eq(sales.storeId, storeId), eq(sales.status, "COMPLETED"), within(sales.date, range)))
    .groupBy(saleItems.productId, saleItems.productName)
    .orderBy(desc(qty))
    .limit(limit);
}

export type CategoryProfit = { categoryName: string; omset: number; grossProfit: number };

// Laba kotor per kategori barang dalam periode, terbesar dulu.
export async function getCategoryProfit(storeId: string, range: Range): Promise<CategoryProfit[]> {
  await io();
  const grossProfit = money(saleItems.grossProfit);
  return db
    .select({ categoryName: productCategories.name, omset: money(saleItems.subtotal), grossProfit })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(and(eq(sales.storeId, storeId), eq(sales.status, "COMPLETED"), within(sales.date, range)))
    .groupBy(productCategories.name)
    .orderBy(desc(grossProfit));
}

// Piutang berjalan = Σ sisa bon yang belum lunas, posisi saat ini (semua periode).
export async function getOutstandingCredit(storeId: string): Promise<number> {
  await io();
  const paid = db
    .select({ saleId: creditPayments.saleId, paid: sum(creditPayments.amount).as("paid") })
    .from(creditPayments)
    .where(and(eq(creditPayments.storeId, storeId), eq(creditPayments.status, "COMPLETED")))
    .groupBy(creditPayments.saleId)
    .as("paid_per_sale");
  const [row] = await db
    .select({ outstanding: money(sql`${sales.total} - coalesce(${paid.paid}, 0)`) })
    .from(sales)
    .leftJoin(paid, eq(paid.saleId, sales.id))
    .where(
      and(
        eq(sales.storeId, storeId),
        eq(sales.paymentMethod, "CREDIT"),
        eq(sales.status, "COMPLETED"),
        eq(sales.paymentStatus, "UNPAID"),
      ),
    );
  return row?.outstanding ?? 0;
}

export type RestockItem = { id: string; name: string; unit: string; stock: number; minStock: number | null };

// Barang aktif yang perlu restock: stok minus, atau ≤ stok minimum bila dipantau.
export async function getRestockList(storeId: string, limit = 10): Promise<RestockItem[]> {
  await io();
  return db
    .select({ id: products.id, name: products.name, unit: products.unit, stock: products.stock, minStock: products.minStock })
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.isActive, true),
        or(lt(products.stock, 0), and(isNotNull(products.minStock), lte(products.stock, products.minStock))),
      ),
    )
    .orderBy(sql`${products.stock} - coalesce(${products.minStock}, 0)`)
    .limit(limit);
}

// Dipakai beranda: total penjualan hari ini saja (tanpa rincian).
export async function getOmset(storeId: string, range: Range) {
  await io();
  const [row] = await db
    .select({ omset: money(sales.total), count: sql<number>`count(*)`.mapWith(Number) })
    .from(sales)
    .where(and(eq(sales.storeId, storeId), eq(sales.status, "COMPLETED"), within(sales.date, range)));
  return { omset: row?.omset ?? 0, count: row?.count ?? 0 };
}

// Tahun yang punya penjualan (filter laporan tahunan), terbaru dulu.
export async function listReportYears(storeId: string): Promise<number[]> {
  await io();
  const rows = await db
    .selectDistinct({ year: sales.periodYear })
    .from(sales)
    .where(eq(sales.storeId, storeId))
    .orderBy(desc(sales.periodYear));
  return rows.map((row) => row.year);
}
