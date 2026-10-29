// Halaman /stores.
// - Superadmin: daftar semua toko + tombol tambah.
// - Pemilik: langsung diarahkan ke halaman tokonya sendiri (/stores/[id]).
//
// Judul & tombol bergantung pada role, jadi seluruh isi ada di dalam <Suspense>.
// Filter (?status=&type=) dibaca dari searchParams (docs/ARCHITECTURE.md §3).

import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StoresTable } from "@/features/stores/components/stores-table";
import { listBusinessTypes, listStores } from "@/features/stores/queries";
import { parseStoreFilters } from "@/features/stores/schemas";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Toko",
};

export default function StoresPage({ searchParams }: PageProps<"/stores">) {
  return (
    <Suspense fallback={<StoresSkeleton />}>
      <StoresContent searchParams={searchParams} />
    </Suspense>
  );
}

async function StoresContent({ searchParams }: Pick<PageProps<"/stores">, "searchParams">) {
  const user = await verifySession();

  if (!can(user, "store:manage")) {
    // Pemilik/Kasir: hanya tokonya sendiri. Tanpa toko (seharusnya tidak
    // terjadi selain Superadmin) → beranda.
    redirect(user.storeId ? `/stores/${user.storeId}` : "/");
  }

  const filters = parseStoreFilters(await searchParams);
  const [stores, businessTypes] = await Promise.all([listStores(filters), listBusinessTypes()]);

  return (
    <>
      <PageHeader
        title="Toko"
        description="Semua toko yang memakai SakuDagang. Buat toko, lalu tambahkan akun pemiliknya."
        action={
          <Button nativeButton={false} render={<Link href="/stores/new" />}>
            <PlusIcon />
            Tambah toko
          </Button>
        }
      />
      <StoresTable stores={stores} filters={filters} businessTypes={businessTypes} />
    </>
  );
}

function StoresSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-9 w-full max-w-xs" />
      <Skeleton className="h-48 w-full" />
    </>
  );
}
