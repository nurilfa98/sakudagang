// Halaman /users/[id]: detail, edit, reset password, dan aktif/nonaktif.
//
// [id] adalah dynamic segment. Dengan cacheComponents, nilai params baru
// diketahui saat request, jadi aksesnya wajib di dalam <Suspense>.
//
// Referensi:
// - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
// - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md

import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAccountActions } from "@/features/users/components/user-account-actions";
import { UserEditForm } from "@/features/users/components/user-edit-form";
import { UserStatusBadge } from "@/features/users/components/user-badges";
import { getUserDetail } from "@/features/users/queries";
import { canManageUser } from "@/features/users/service";
import { requirePermission } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Detail Pengguna",
};

export default function UserDetailPage({ params }: PageProps<"/users/[id]">) {
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/users" />}>
          <ArrowLeftIcon />
          Daftar pengguna
        </Button>
      </div>
      <Suspense fallback={<UserDetailSkeleton />}>
        {params.then(({ id }) => (
          <UserDetailContent id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function UserDetailContent({ id }: { id: string }) {
  const actor = await requirePermission("user:manage-cashier");
  const user = await getUserDetail(id);
  // Tidak berhak (toko lain, atau pemilik dilihat oleh pemilik) = "tidak ditemukan".
  if (!user || !canManageUser(actor, user)) notFound();

  const isSelf = user.id === actor.id;
  const roleLabel = ROLE_LABELS[user.role];

  return (
    <>
      <PageHeader
        title={user.fullName}
        description={`${roleLabel}${user.storeName ? ` · ${user.storeName}` : ""} · ${user.email}`}
        action={<UserStatusBadge user={user} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Data pengguna</CardTitle>
          <CardDescription>Nama dan email untuk login.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserEditForm user={user} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Akun</CardTitle>
          <CardDescription>Password dan status akses pengguna.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserAccountActions user={user} isSelf={isSelf} />
        </CardContent>
      </Card>
    </>
  );
}

function UserDetailSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-64 w-full" />
    </>
  );
}
