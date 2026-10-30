// Halaman /purchases: daftar pembelian (barang masuk) satu toko. Hanya Pemilik.
//
// Filter daftar (?status=&year=&month=) dibaca dari searchParams di dalam
// <Suspense> (docs/ARCHITECTURE.md §3 "Daftar data").

import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchasesTable } from "@/features/purchases/components/purchases-table";
import { listPurchases, listPurchaseYears } from "@/features/purchases/queries";
import { parsePurchaseFilters } from "@/features/purchases/schemas";
import { requireStore } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Pembelian",
};

export default function PurchasesPage({ searchParams }: PageProps<"/purchases">) {
  return (
    <>
      <PageHeader
        title="Pembelian"
        description="Belanja stok (barang masuk). Setiap pembelian menambah stok dan memperbarui harga modal."
        action={
          <Button nativeButton={false} render={<Link href="/purchases/new" />}>
            <PlusIcon />
            Catat pembelian
          </Button>
        }
      />
      <Suspense fallback={<PurchasesSkeleton />}>
        <PurchasesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PurchasesContent({ searchParams }: Pick<PageProps<"/purchases">, "searchParams">) {
  const actor = await requireStore("purchase:manage");
  const filters = parsePurchaseFilters(await searchParams);
  const [purchases, years] = await Promise.all([
    listPurchases(actor.storeId, filters),
    listPurchaseYears(actor.storeId),
  ]);

  return <PurchasesTable purchases={purchases} filters={filters} years={years} />;
}

function PurchasesSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-full max-w-xs" />
      <Skeleton className="h-64 w-full" />
    </>
  );
}
