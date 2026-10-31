// Halaman /users/new: tambah pengguna baru.
// - Pemilik: toko tetap (tokonya), role tetap Kasir.
// - Superadmin: toko = toko yang sedang dibuka (belum membuka → daftar toko),
//   role Pemilik atau Kasir (?role= sebagai bawaan).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCreateForm } from "@/features/users/components/user-create-form";
import { assignableRolesFor, managedStoreId } from "@/features/users/service";
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
  const storeId = managedStoreId(actor);
  if (!storeId) redirect("/stores");
  const roleChoices = assignableRolesFor(actor);

  const { role } = await searchParams;
  const requestedRole = Array.isArray(role) ? role[0] : role;
  const defaultRole = roleChoices.find((r) => r === requestedRole) ?? roleChoices[0] ?? "CASHIER";

  // Toko selalu tetap: toko Pemilik, atau toko yang sedang dibuka Superadmin.
  return <UserCreateForm defaultStoreId={storeId} roleChoices={roleChoices} defaultRole={defaultRole} backHref="/users" />;
}
