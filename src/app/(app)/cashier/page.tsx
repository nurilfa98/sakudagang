// Halaman /cashier: layar penjualan (Kasir & Pemilik, permission sale:create).
// Daftar barang yang dikirim ke browser TIDAK berisi harga modal.
//
// Tombol mengambang "Kembali ke menu" (MenuFab) sengaja tidak tampil di sini
// agar tidak menutupi bilah Bayar di HP; sebagai gantinya tombol ada di kanan
// judul.

import { LayoutGridIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
      <PageHeader
        title="Kasir"
        actionInline
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            <LayoutGridIcon />
            Kembali ke menu
          </Button>
        }
      />
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
