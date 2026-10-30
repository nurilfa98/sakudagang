// Halaman /cashier: layar penjualan (Kasir & Pemilik, permission sale:create).
// Daftar barang yang dikirim ke browser TIDAK berisi harga modal.

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listCustomerOptions } from "@/features/credits/queries";
import { CashierScreen } from "@/features/sales/components/cashier-screen";
import { listCashierProducts } from "@/features/sales/queries";
import { requireStore } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Kasir",
};

export default function CashierPage() {
  return (
    <>
      <PageHeader title="Kasir" />
      <Suspense fallback={<CashierSkeleton />}>
        <CashierContent />
      </Suspense>
    </>
  );
}

async function CashierContent() {
  const actor = await requireStore("sale:create");
  const [products, customers] = await Promise.all([
    listCashierProducts(actor.storeId),
    listCustomerOptions(actor.storeId),
  ]);
  return <CashierScreen products={products} customers={customers} />;
}

function CashierSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      <Skeleton className="h-96" />
      <Skeleton className="h-96" />
    </div>
  );
}
