// Halaman /expenses/categories: kelola kategori pengeluaran (Pemilik).

import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CategoryManager } from "@/components/category-manager";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createExpenseCategory,
  deleteExpenseCategory,
  renameExpenseCategory,
} from "@/features/expenses/actions";
import { listExpenseCategories } from "@/features/expenses/queries";
import { requireStore } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Kategori Pengeluaran",
};

export default function ExpenseCategoriesPage() {
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/expenses" />}>
          <ArrowLeftIcon />
          Daftar pengeluaran
        </Button>
      </div>
      <PageHeader
        title="Kategori pengeluaran"
        description="Mengelompokkan biaya operasional di laporan, mis. listrik, transport, gaji."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-xl" />}>
        <ExpenseCategoriesContent />
      </Suspense>
    </>
  );
}

async function ExpenseCategoriesContent() {
  const actor = await requireStore("expense:manage");
  const categories = await listExpenseCategories(actor.storeId);
  return (
    <CategoryManager
      categories={categories.map((category) => ({ ...category, usageCount: category.expenseCount }))}
      actions={{ create: createExpenseCategory, rename: renameExpenseCategory, remove: deleteExpenseCategory }}
      usageLabel="pengeluaran"
    />
  );
}
