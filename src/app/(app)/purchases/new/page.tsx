// Halaman /purchases/new: catat pembelian / barang masuk (Pemilik).

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchaseForm } from "@/features/purchases/components/purchase-form";
import { listPurchasableProducts } from "@/features/purchases/queries";
import { requireStore } from "@/lib/auth/dal";
import { zonedDateString } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Catat Pembelian",
};

export default function NewPurchasePage() {
  return (
    <>
      <PageHeader
        title="Catat pembelian"
        description="Satu kali belanja stok, boleh berisi banyak barang. Setelah disimpan tidak bisa diedit, hanya dibatalkan."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NewPurchaseContent />
      </Suspense>
    </>
  );
}

async function NewPurchaseContent() {
  const actor = await requireStore("purchase:manage");
  const products = await listPurchasableProducts(actor.storeId);
  // "Hari ini" menurut zona waktu toko, bukan zona waktu server/browser.
  return <PurchaseForm products={products} today={zonedDateString(new Date())} />;
}
