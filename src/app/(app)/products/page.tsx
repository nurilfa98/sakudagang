// Halaman /products: master barang & stok satu toko.
// - Pemilik: lihat harga modal, tambah/ubah barang, kelola kategori.
// - Kasir: hanya daftar nama, harga jual, stok (tanpa harga modal, tanpa link detail).
//
// Filter daftar (?category=&status=&stock=) dibaca dari searchParams di
// dalam <Suspense> (docs/ARCHITECTURE.md §3 "Daftar data").

import { PlusIcon, TagsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductsTable } from "@/features/products/components/products-table";
import { listCategories, listProducts } from "@/features/products/queries";
import { parseProductFilters } from "@/features/products/schemas";
import { requireStore } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Barang",
};

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductsContent({ searchParams }: Pick<PageProps<"/products">, "searchParams">) {
  const actor = await requireStore("product:view");
  const withCost = can(actor, "product:view-cost");
  const canManage = can(actor, "product:manage");
  const filters = parseProductFilters(await searchParams);
  const [products, categories] = await Promise.all([
    listProducts(actor.storeId, { withCost, ...filters }),
    listCategories(actor.storeId),
  ]);

  return (
    <>
      <PageHeader
        title="Barang"
        description={canManage ? "Master barang, harga, dan stok toko Anda." : "Daftar barang dan harga jual."}
        action={
          canManage && (
            <div className="flex gap-2">
              <Button variant="outline" nativeButton={false} render={<Link href="/products/categories" />}>
                <TagsIcon />
                Kategori
              </Button>
              <Button nativeButton={false} render={<Link href="/products/new" />}>
                <PlusIcon />
                Tambah barang
              </Button>
            </div>
          )
        }
      />
      <ProductsTable
        products={products}
        withCost={withCost}
        canManage={canManage}
        filters={filters}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
      />
    </>
  );
}

function ProductsSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-9 w-full max-w-xs" />
      <Skeleton className="h-64 w-full" />
    </>
  );
}
