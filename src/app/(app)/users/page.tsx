// Halaman /users: daftar pengguna.
// - Pemilik: kasir di tokonya sendiri.
// - Superadmin: semua pemilik & kasir lintas toko; filter ?storeId= memilih
//   satu toko (tombol "Pengguna" di kartu toko beranda mengarah ke sini).
// Akun Superadmin tidak pernah tampil (features/users/queries.ts).
//
// Filter (?storeId=&role=&status=) dibaca dari searchParams di dalam
// <Suspense> (docs/ARCHITECTURE.md §3 "Daftar data").
//
// Referensi:
// - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md (searchParams)

import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listStoreOptions } from "@/features/stores/queries";
import { UsersTable } from "@/features/users/components/users-table";
import { listUsers } from "@/features/users/queries";
import { parseUserFilters } from "@/features/users/schemas";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Pengguna",
};

export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersContent({ searchParams }: Pick<PageProps<"/users">, "searchParams">) {
  const actor = await requirePermission("user:manage-cashier");
  const platformAdmin = actor.storeId === null;

  // Pemilik selalu terkunci ke tokonya; Superadmin memilih lewat filter.
  const filters = parseUserFilters(await searchParams, { allowStore: platformAdmin });
  const storeId = actor.storeId ?? filters.storeId;

  const [users, storeOptions] = await Promise.all([
    listUsers({ ...filters, storeId }),
    platformAdmin ? listStoreOptions() : Promise.resolve([]),
  ]);
  const selectedStore = storeOptions.find((store) => store.id === storeId);
  const newHref = storeId ? `/users/new?storeId=${storeId}` : "/users/new";

  return (
    <>
      <PageHeader
        title="Pengguna"
        description={
          !platformAdmin
            ? "Kelola akun kasir, reset password, dan status aktif."
            : selectedStore
              ? `Pengguna toko ${selectedStore.name}.`
              : "Semua pemilik dan kasir di seluruh toko."
        }
        action={
          <Button nativeButton={false} render={<Link href={newHref} />}>
            <PlusIcon />
            Tambah pengguna
          </Button>
        }
      />
      <UsersTable
        users={users}
        showStore={platformAdmin}
        filters={filters}
        storeOptions={storeOptions.map((store) => ({ value: store.id, label: store.name }))}
      />
    </>
  );
}

function UsersSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-9 w-full max-w-xs" />
      <Skeleton className="h-48 w-full" />
    </>
  );
}
