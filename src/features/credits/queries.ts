// Query database untuk pelanggan & bon (piutang). Semua fungsi menerima
// storeId dari requireStore() dan SELALU memfilternya (multi-tenant).
//
// Sisa bon tidak disimpan: total penjualan bon − Σ pelunasan COMPLETED
// (docs/DATABASE-SCHEMA.md §4). Hanya penjualan COMPLETED yang dihitung.
//
// Penjelasan `await io()` ada di features/stores/queries.ts.

import "server-only";
import { and, asc, count, desc, eq, isNotNull, lte, sql, sum } from "drizzle-orm";
import { io } from "next/cache";
import { formatDateOnly, formatDateTime, zonedDateString } from "@/lib/dates";
import { db } from "@/lib/db";
import { creditPayments, customers, sales, users } from "@/lib/db/schema";
import type { CreditPaymentMethod, CreditPaymentStatus } from "./constants";
import type { CustomerFilters } from "./schemas";
import { remainingCredit } from "./service";

const LIST_LIMIT = 500;

export type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  allowCredit: boolean;
};

export type CustomerCreditSummary = CustomerOption & {
  openCount: number; // jumlah bon belum lunas
  outstanding: number; // sisa piutang
  oldestOpenDate: string | null; // tanggal bon belum lunas tertua
  oldestOpenLabel: string | null;
};

export type CreditSaleItem = {
  id: string;
  number: string;
  date: string;
  dateLabel: string;
  total: number;
  paid: number;
  remaining: number;
  paymentStatus: "PAID" | "UNPAID";
};

export type CreditPaymentItem = {
  id: string;
  saleId: string;
  saleNumber: string;
  date: string;
  dateLabel: string;
  amount: number;
  paymentMethod: CreditPaymentMethod;
  status: CreditPaymentStatus;
  voidReason: string | null;
  createdById: string;
  createdByName: string;
  createdAtLabel: string;
  createdDate: string; // tanggal dicatat (zona toko), dasar aturan batal hari yang sama
};

const customerColumns = {
  id: customers.id,
  name: customers.name,
  phone: customers.phone,
  note: customers.note,
  allowCredit: customers.allowCredit,
};

// Pilihan pelanggan di layar kasir (bon). Pelanggan yang tidak boleh bon
// tetap dikirim agar kasir melihat alasannya, bukan sekadar tidak ditemukan.
export async function listCustomerOptions(storeId: string): Promise<CustomerOption[]> {
  await io();
  return db.select(customerColumns).from(customers).where(eq(customers.storeId, storeId)).orderBy(asc(customers.name));
}

// Σ pelunasan berlaku per penjualan (subquery).
function paidPerSale(storeId: string) {
  return db
    .select({ saleId: creditPayments.saleId, paid: sum(creditPayments.amount).as("paid") })
    .from(creditPayments)
    .where(and(eq(creditPayments.storeId, storeId), eq(creditPayments.status, "COMPLETED")))
    .groupBy(creditPayments.saleId)
    .as("paid_per_sale");
}

// Daftar pelanggan beserta piutangnya, terbesar dulu. `today` dipakai filter
// "bon lama" (> 30 hari, BUSINESS-FLOW §10.4).
export async function listCustomerCreditSummaries(
  storeId: string,
  { credit, today, overdueDays, limit = LIST_LIMIT }: CustomerFilters & { today: string; overdueDays: number; limit?: number },
): Promise<CustomerCreditSummary[]> {
  await io();
  const paid = paidPerSale(storeId);
  const open = db
    .select({
      customerId: sales.customerId,
      openCount: count(sales.id).as("open_count"),
      outstanding: sql<string>`sum(${sales.total} - coalesce(${paid.paid}, 0))`.as("outstanding"),
      oldestOpenDate: sql<string>`min(${sales.date})`.as("oldest_open_date"),
    })
    .from(sales)
    .leftJoin(paid, eq(paid.saleId, sales.id))
    .where(
      and(
        eq(sales.storeId, storeId),
        eq(sales.paymentMethod, "CREDIT"),
        eq(sales.status, "COMPLETED"),
        eq(sales.paymentStatus, "UNPAID"),
      ),
    )
    .groupBy(sales.customerId)
    .as("open_credit");

  const cutoff = shiftDate(today, -overdueDays);
  const rows = await db
    .select({ ...customerColumns, openCount: open.openCount, outstanding: open.outstanding, oldestOpenDate: open.oldestOpenDate })
    .from(customers)
    .leftJoin(open, eq(open.customerId, customers.id))
    .where(
      and(
        eq(customers.storeId, storeId),
        credit === "OUTSTANDING" ? isNotNull(open.customerId) : undefined,
        credit === "OVERDUE" ? lte(open.oldestOpenDate, cutoff) : undefined,
      ),
    )
    .orderBy(sql`${open.outstanding} desc nulls last`, asc(customers.name))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    openCount: Number(row.openCount ?? 0),
    outstanding: Number(row.outstanding ?? 0),
    oldestOpenLabel: row.oldestOpenDate ? formatDateOnly(row.oldestOpenDate) : null,
  }));
}

export async function getCustomer(storeId: string, id: string): Promise<CustomerOption | null> {
  await io();
  const [row] = await db
    .select(customerColumns)
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.storeId, storeId)))
    .limit(1);
  return row ?? null;
}

// Penjualan bon satu pelanggan: belum lunas dulu (tertua di atas), lalu yang lunas.
export async function listCustomerCreditSales(storeId: string, customerId: string): Promise<CreditSaleItem[]> {
  await io();
  const paid = paidPerSale(storeId);
  const rows = await db
    .select({
      id: sales.id,
      number: sales.number,
      date: sales.date,
      total: sales.total,
      paid: paid.paid,
      paymentStatus: sales.paymentStatus,
    })
    .from(sales)
    .leftJoin(paid, eq(paid.saleId, sales.id))
    .where(
      and(
        eq(sales.storeId, storeId),
        eq(sales.customerId, customerId),
        eq(sales.paymentMethod, "CREDIT"),
        eq(sales.status, "COMPLETED"),
      ),
    )
    .orderBy(desc(sales.paymentStatus), sql`case when ${sales.paymentStatus} = 'UNPAID' then ${sales.date} end asc`, desc(sales.date))
    .limit(LIST_LIMIT);

  return rows.map((row) => {
    const paidAmount = Number(row.paid ?? 0);
    return {
      ...row,
      paymentStatus: row.paymentStatus as CreditSaleItem["paymentStatus"],
      paid: paidAmount,
      remaining: remainingCredit(row.total, paidAmount),
      dateLabel: formatDateOnly(row.date),
    };
  });
}

// Riwayat pelunasan per pelanggan atau per penjualan, terbaru dulu.
export async function listCreditPayments(
  storeId: string,
  filter: { customerId: string } | { saleId: string },
): Promise<CreditPaymentItem[]> {
  await io();
  const rows = await db
    .select({
      id: creditPayments.id,
      saleId: creditPayments.saleId,
      saleNumber: sales.number,
      date: creditPayments.date,
      amount: creditPayments.amount,
      paymentMethod: creditPayments.paymentMethod,
      status: creditPayments.status,
      voidReason: creditPayments.voidReason,
      createdById: creditPayments.createdById,
      createdByName: users.fullName,
      createdAt: creditPayments.createdAt,
    })
    .from(creditPayments)
    .innerJoin(sales, eq(creditPayments.saleId, sales.id))
    .innerJoin(users, eq(creditPayments.createdById, users.id))
    .where(
      and(
        eq(creditPayments.storeId, storeId),
        "customerId" in filter
          ? eq(creditPayments.customerId, filter.customerId)
          : eq(creditPayments.saleId, filter.saleId),
      ),
    )
    .orderBy(desc(creditPayments.date), desc(creditPayments.createdAt))
    .limit(LIST_LIMIT);

  return rows.map(({ createdAt, ...row }) => ({
    ...row,
    paymentMethod: row.paymentMethod as CreditPaymentMethod,
    status: row.status as CreditPaymentStatus,
    dateLabel: formatDateOnly(row.date),
    createdAtLabel: formatDateTime(createdAt),
    createdDate: zonedDateString(createdAt),
  }));
}

// "2026-10-31", −30 → "2026-10-01" (tanggal kalender, tanpa zona waktu).
function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
