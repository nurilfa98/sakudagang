// Halaman /users/[id]: detail, edit, reset password, dan aktif/nonaktif.
// Juga dipakai sebagai "Profile" (menu user di navbar): siapa pun boleh
// membuka & mengubah datanya sendiri; Pemilik melihat Pemilik lain setoko
// tanpa bisa mengubah; aksi akun hanya untuk pengelola (service.ts).
//
// [id] adalah dynamic segment. Dengan cacheComponents, nilai params baru
// diketahui saat request, jadi aksesnya wajib di dalam <Suspense>.
//
// Referensi:
// - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
// - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md

import { ArrowLeftIcon, KeyRoundIcon } from "lucide-react";
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
import { canEditUser, canManageUser, canViewUser } from "@/features/users/service";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Detail Pengguna",
};

export default function UserDetailPage({ params }: PageProps<"/users/[id]">) {
  return (
    <>
      <Suspense>
        <BackLink />
      </Suspense>
      <Suspense fallback={<UserDetailSkeleton />}>
        {params.then(({ id }) => (
          <UserDetailContent id={id} />
        ))}
      </Suspense>
    </>
  );
}

// Kasir tidak punya menu Pengguna; dari Profile ia kembali ke beranda.
async function BackLink() {
  const actor = await verifySession();
  const toList = can(actor, "user:manage-cashier");
  return (
    <div>
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={toList ? "/users" : "/"} />}>
        <ArrowLeftIcon />
        {toList ? "Daftar pengguna" : "Beranda"}
      </Button>
    </div>
  );
}

async function UserDetailContent({ id }: { id: string }) {
  const actor = await verifySession();
  const user = await getUserDetail(id);
  // Tidak berhak (toko lain) = "tidak ditemukan", agar keberadaan akun lain tidak bocor.
  if (!user || !canViewUser(actor, user)) notFound();

  const isSelf = user.id === actor.id;
  const canEdit = canEditUser(actor, user);
  const canManage = canManageUser(actor, user);
  const roleLabel = ROLE_LABELS[user.role];

  return (
    <>
      <PageHeader
        title={isSelf ? "Profile" : user.fullName}
        description={`${isSelf ? `${user.fullName} · ` : ""}${roleLabel}${user.storeName ? ` · ${user.storeName}` : ""} · ${user.email}`}
        action={<UserStatusBadge user={user} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Data pengguna</CardTitle>
          <CardDescription>
            {canEdit ? "Nama, email untuk login, dan nomor WhatsApp." : "Hanya bisa dilihat; perubahan akun Pemilik lain dilakukan oleh admin SakuDagang."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <UserEditForm user={user} />
          ) : (
            <dl className="grid max-w-xl gap-3 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Nama</dt>
              <dd>{user.fullName}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{user.email}</dd>
              <dt className="text-muted-foreground">WhatsApp</dt>
              <dd>{user.phone ? formatPhone(user.phone) : "-"}</dd>
            </dl>
          )}
        </CardContent>
      </Card>
      {isSelf && (
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Ganti password akun Anda sendiri.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" nativeButton={false} render={<Link href="/change-password" />}>
              <KeyRoundIcon />
              Ganti password
            </Button>
          </CardContent>
        </Card>
      )}
      {canManage && !isSelf && (
        <Card>
          <CardHeader>
            <CardTitle>Akun</CardTitle>
            <CardDescription>Password dan status akses pengguna.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserAccountActions user={user} isSelf={isSelf} />
          </CardContent>
        </Card>
      )}
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
