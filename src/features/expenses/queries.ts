// Query database untuk halaman Pengeluaran (Pemilik, expense:manage). Semua
// fungsi menerima storeId dari requireStore() dan SELALU memfilternya.
//
// Penjelasan `await io()` ada di features/stores/queries.ts.

import "server-only";
import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { io } from "next/cache";
import { formatDateOnly, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { expenseCategories, expenses, users } from "@/lib/db/schema";
import type { ExpenseFilters } from "./schemas";

// Pencarian, urutan, dan halaman berjalan di browser (docs/ARCHITECTURE.md §3).
const LIST_LIMIT = 500;

export type ExpenseItem = {
  id: string;
  date: string;
  dateLabel: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  note: string | null;
  createdByName: string;
  updatedAtLabel: string;
};

export type ExpenseCategoryItem = { id: string; name: string; sortOrder: number; expenseCount: number };

// Filter periode memakai kolom `date` (tanggal kalender): rentang
// [awal bulan/tahun, awal bulan/tahun berikutnya) dalam teks "YYYY-MM-DD".
export async function listExpenses(
  storeId: string,
  { year, month, categoryId, limit = LIST_LIMIT }: ExpenseFilters & { limit?: number },
): Promise<ExpenseItem[]> {
  await io();
  const period = year ? datePeriod(year, month) : null;
  const rows = await db
    .select({
      id: expenses.id,
      date: expenses.date,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      amount: expenses.amount,
      note: expenses.note,
      createdByName: users.fullName,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .innerJoin(users, eq(expenses.createdById, users.id))
    .where(
      and(
        eq(expenses.storeId, storeId),
        period ? gte(expenses.date, period.start) : undefined,
        period ? lt(expenses.date, period.end) : undefined,
        categoryId ? eq(expenses.categoryId, categoryId) : undefined,
      ),
    )
    .orderBy(desc(expenses.date), desc(expenses.createdAt))
    .limit(limit);

  return rows.map(({ updatedAt, ...row }) => ({
    ...row,
    dateLabel: formatDateOnly(row.date),
    updatedAtLabel: formatDateTime(updatedAt),
  }));
}

export async function listExpenseCategories(storeId: string): Promise<ExpenseCategoryItem[]> {
  await io();
  return db
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      sortOrder: expenseCategories.sortOrder,
      expenseCount: count(expenses.id),
    })
    .from(expenseCategories)
    .leftJoin(expenses, eq(expenses.categoryId, expenseCategories.id))
    .where(eq(expenseCategories.storeId, storeId))
    .groupBy(expenseCategories.id)
    .orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name));
}

// Tahun yang punya pengeluaran, terbaru dulu, untuk filter Tahun.
export async function listExpenseYears(storeId: string): Promise<number[]> {
  await io();
  const year = sql<number>`extract(year from ${expenses.date})::int`;
  const rows = await db
    .selectDistinct({ year })
    .from(expenses)
    .where(eq(expenses.storeId, storeId))
    .orderBy(desc(year));
  return rows.map((row) => row.year);
}

// 2026, 10 → { start: "2026-10-01", end: "2026-11-01" }; tanpa bulan = satu tahun.
function datePeriod(year: number, month?: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  if (!month) return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return { start: `${year}-${pad(month)}-01`, end: `${next.year}-${pad(next.month)}-01` };
}
