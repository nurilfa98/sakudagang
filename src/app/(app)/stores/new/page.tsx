// Halaman /stores/new (Superadmin): buat toko baru.

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreForm } from "@/features/stores/components/store-form";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Tambah Toko",
};

export default function NewStorePage() {
  return (
    <>
      <PageHeader
        title="Tambah toko"
        description="Setelah toko dibuat, Anda diarahkan ke halaman toko untuk menambahkan akun pemiliknya."
      />
      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-80 w-full max-w-xl" />}>
            <NewStoreContent />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function NewStoreContent() {
  await requirePermission("store:manage");
  return <StoreForm cancelHref="/stores" />;
}
