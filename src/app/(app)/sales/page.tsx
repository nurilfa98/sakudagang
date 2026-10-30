// Halaman /sales: riwayat penjualan satu hari (bawaan hari ini).
// - Pemilik: semua transaksi, dengan kolom laba kotor.
// - Kasir: hanya transaksinya sendiri, tanpa laba.
//
// Filter (?date=&method=&status=) dibaca dari searchParams di dalam
// <Suspense> (docs/ARCHITECTURE.md §3 "Daftar data").

import { ShoppingCartIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesTable } from "@/features/sales/components/sales-table";
import { listSales } from "@/features/sales/queries";
import { parseSaleFilters } from "@/features/sales/schemas";
import { requireStore } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { zonedDateString } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Penjualan",
};

export default function SalesPage({ searchParams }: PageProps<"/sales">) {
  return (
    <>
      <PageHeader
        title="Penjualan"
        description="Riwayat transaksi kasir per hari. Transaksi yang dibatalkan tetap tampil."
        action={
          <Button nativeButton={false} render={<Link href="/cashier" />}>
            <ShoppingCartIcon />
            Buka kasir
          </Button>
        }
      />
      <Suspense fallback={<SalesSkeleton />}>
        <SalesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SalesContent({ searchParams }: Pick<PageProps<"/sales">, "searchParams">) {
  const actor = await requireStore("sale:create");
  const withCost = can(actor, "product:view-cost");
  const filters = parseSaleFilters(await searchParams);
  const today = zonedDateString(new Date());
  const date = filters.date ?? today;
  const sales = await listSales(actor.storeId, {
    ...filters,
    date,
    withCost,
    createdById: can(actor, "sale:void-all") ? undefined : actor.id,
  });

  return <SalesTable sales={sales} withCost={withCost} filters={filters} date={date} today={today} />;
}

function SalesSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-full max-w-xs" />
      <Skeleton className="h-64 w-full" />
    </>
  );
}
