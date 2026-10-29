// Halaman /products/new: tambah barang (Pemilik).

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductForm } from "@/features/products/components/product-form";
import { listCategories } from "@/features/products/queries";
import { requireStore } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Tambah Barang",
};

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Tambah barang" description="Nama, kategori, satuan, harga jual, dan stok awal bila ada." />
      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96 w-full max-w-xl" />}>
            <NewProductContent />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function NewProductContent() {
  const actor = await requireStore("product:manage");
  const categories = await listCategories(actor.storeId);
  return <ProductForm categories={categories} />;
}
