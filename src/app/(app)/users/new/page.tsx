// Halaman /users/new: tambah pengguna baru.
// - Pemilik: toko tetap (tokonya), role tetap Kasir.
// - Superadmin: pilih toko (?storeId= sebagai bawaan) dan role (?role=).

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listStoreOptions } from "@/features/stores/queries";
import { UserCreateForm } from "@/features/users/components/user-create-form";
import { ASSIGNABLE_ROLES, assignableRolesFor, type AssignableRole } from "@/features/users/service";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Tambah Pengguna",
};

export default function NewUserPage({ searchParams }: PageProps<"/users/new">) {
  return (
    <>
      <PageHeader
        title="Tambah pengguna"
        description="Password sementara dibuat otomatis dan ditampilkan setelah disimpan. Pengguna wajib menggantinya saat login pertama."
      />
      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-72 w-full max-w-md" />}>
            <NewUserContent searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function NewUserContent({ searchParams }: Pick<PageProps<"/users/new">, "searchParams">) {
  const actor = await requirePermission("user:manage-cashier");
  const roleChoices = assignableRolesFor(actor);

  const { storeId, role } = await searchParams;
  const requestedStore = (Array.isArray(storeId) ? storeId[0] : storeId)?.slice(0, 36);
  const requestedRole = Array.isArray(role) ? role[0] : role;
  const defaultRole = roleChoices.find((r) => r === requestedRole) ?? roleChoices[0] ?? "CASHIER";

  // Pemilik: toko sudah tetap. Superadmin: pilih dari toko aktif.
  if (actor.storeId) {
    return (
      <UserCreateForm
        defaultStoreId={actor.storeId}
        roleChoices={roleChoices}
        defaultRole={defaultRole}
        backHref="/users"
      />
    );
  }

  const stores = await listStoreOptions();
  return (
    <UserCreateForm
      stores={stores}
      defaultStoreId={stores.some((s) => s.id === requestedStore) ? requestedStore : undefined}
      roleChoices={roleChoices.length > 0 ? roleChoices : [...ASSIGNABLE_ROLES]}
      defaultRole={defaultRole as AssignableRole}
      backHref={requestedStore ? `/stores/${requestedStore}` : "/users"}
    />
  );
}
