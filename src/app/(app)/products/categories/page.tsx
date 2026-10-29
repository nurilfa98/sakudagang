// Halaman /products/categories: kelola kategori barang (Pemilik).

import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryManager } from "@/features/products/components/category-manager";
import { listCategories } from "@/features/products/queries";
import { requireStore } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Kategori Barang",
};

export default function CategoriesPage() {
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/products" />}>
          <ArrowLeftIcon />
          Daftar barang
        </Button>
      </div>
      <PageHeader
        title="Kategori barang"
        description="Kategori dipakai untuk mengelompokkan barang dan laporan laba per kategori."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-xl" />}>
        <CategoriesContent />
      </Suspense>
    </>
  );
}

async function CategoriesContent() {
  const actor = await requireStore("product:manage");
  const categories = await listCategories(actor.storeId);
  return <CategoryManager categories={categories} />;
}
