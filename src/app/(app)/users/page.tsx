// Halaman /users: daftar pengguna toko.
// - Pemilik: kasir (dan pemilik lain) di tokonya sendiri.
// - Superadmin: pemilik & kasir toko yang sedang dibuka (pola sama dengan
//   ArchiPay); belum membuka toko → daftar toko.
// Akun Superadmin tidak pernah tampil (features/users/queries.ts).
//
// Filter (?role=&status=) dibaca dari searchParams di dalam
// <Suspense> (docs/ARCHITECTURE.md §3 "Daftar data").
//
// Referensi:
// - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md (searchParams)

import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersTable } from "@/features/users/components/users-table";
import { listUsers } from "@/features/users/queries";
import { parseUserFilters } from "@/features/users/schemas";
import { managedStoreId } from "@/features/users/service";
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
  const storeId = managedStoreId(actor);
  if (!storeId) redirect("/stores");

  const filters = parseUserFilters(await searchParams, { allowStore: false });
  const users = await listUsers({ ...filters, storeId });
  const platformAdmin = actor.storeId === null;

  return (
    <>
      <PageHeader
        title="Pengguna"
        description={
          platformAdmin
            ? `Pemilik & kasir toko ${actor.activeStore?.name ?? ""}: akun, reset password, dan status aktif.`
            : "Kelola akun kasir, reset password, dan status aktif."
        }
        action={
          <Button nativeButton={false} render={<Link href="/users/new" />}>
            <PlusIcon />
            Tambah pengguna
          </Button>
        }
      />
      <UsersTable users={users} showStore={false} filters={filters} />
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
