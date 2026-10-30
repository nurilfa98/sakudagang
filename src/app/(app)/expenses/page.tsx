// Halaman /expenses: pengeluaran operasional (Pemilik, expense:manage).
// Mengurangi laba bersih pada tanggalnya (BUSINESS-FLOW §7).
//
// Filter (?year=&month=&category=) dibaca dari searchParams di dalam <Suspense>.

import { TagsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseDialog } from "@/features/expenses/components/expense-dialog";
import { ExpensesTable } from "@/features/expenses/components/expenses-table";
import { listExpenseCategories, listExpenses, listExpenseYears } from "@/features/expenses/queries";
import { parseExpenseFilters, type ExpenseFilters } from "@/features/expenses/schemas";
import { requireStore } from "@/lib/auth/dal";
import { zonedDateString } from "@/lib/dates";
import { formatRupiah, MONTH_NAMES } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pengeluaran",
};

export default function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  return (
    <Suspense fallback={<ExpensesSkeleton />}>
      <ExpensesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ExpensesContent({ searchParams }: Pick<PageProps<"/expenses">, "searchParams">) {
  const actor = await requireStore("expense:manage");
  const filters = parseExpenseFilters(await searchParams);
  const [expenses, categories, years] = await Promise.all([
    listExpenses(actor.storeId, filters),
    listExpenseCategories(actor.storeId),
    listExpenseYears(actor.storeId),
  ]);
  const today = zonedDateString(new Date());
  const categoryOptions = categories.map(({ id, name }) => ({ id, name }));
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <>
      <PageHeader
        title="Pengeluaran"
        description="Biaya operasional di luar belanja stok. Mengurangi laba bersih pada tanggalnya."
        action={
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/expenses/categories" />}>
              <TagsIcon />
              Kategori
            </Button>
            <ExpenseDialog categories={categoryOptions} today={today} />
          </div>
        }
      />
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Total pengeluaran</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <span className="font-mono text-2xl font-semibold tabular-nums">{formatRupiah(total)}</span>
          <CardDescription>
            {periodLabel(filters)} · {expenses.length.toLocaleString("id-ID")} catatan
          </CardDescription>
        </CardContent>
      </Card>
      <ExpensesTable expenses={expenses} categories={categoryOptions} filters={filters} years={years} today={today} />
    </>
  );
}

function periodLabel({ year, month }: ExpenseFilters) {
  if (!year) return "Semua periode";
  return month ? `${MONTH_NAMES[month - 1]} ${year}` : `Tahun ${year}`;
}

function ExpensesSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-28 w-full max-w-sm" />
      <Skeleton className="h-64 w-full" />
    </>
  );
}
