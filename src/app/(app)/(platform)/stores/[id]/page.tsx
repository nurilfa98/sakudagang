// Halaman /stores/[id]: detail toko.
// - Superadmin (pola sama dengan ArchiPay): status & tombol Buka, data toko,
//   langganan (masa aktif, harga khusus, tagihan, catat pembayaran langsung),
//   daftar pengguna (hanya lihat; pemilik & kasir dikelola dari menu Pengguna
//   setelah membuka toko), dan saklar status toko.
// - Pemilik: data tokonya sendiri + kasir (canEditStore).
//
// [id] adalah dynamic segment. Dengan cacheComponents, nilai params baru
// diketahui saat request, jadi aksesnya wajib di dalam <Suspense>.
//
// Referensi:
// - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
// - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md

import { ArrowLeftIcon, CreditCardIcon, PlusIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EnterStoreButton } from "@/features/stores/components/enter-store-button";
import { accessLabel } from "@/features/stores/components/store-card";
import { StoreForm } from "@/features/stores/components/store-form";
import { StoreStatusActions } from "@/features/stores/components/store-status-actions";
import { StoreStatusBadge } from "@/features/stores/components/store-status-badge";
import { getStore } from "@/features/stores/queries";
import { canEditStore } from "@/features/stores/service";
import { storeStatusOf } from "@/features/stores/status";
import { AdminInvoiceForm } from "@/features/subscriptions/components/admin-invoice-form";
import { StorePricesForm } from "@/features/subscriptions/components/store-prices-form";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import { getStoreSubscriptionState, listPlansForStore } from "@/features/subscriptions/queries";
import { RoleBadge, UserStatusBadge } from "@/features/users/components/user-badges";
import { UsersTable } from "@/features/users/components/users-table";
import { listUsers } from "@/features/users/queries";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatRupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Detail Toko",
};

export default function StoreDetailPage({ params }: PageProps<"/stores/[id]">) {
  return (
    <Suspense fallback={<StoreDetailSkeleton />}>
      {params.then(({ id }) => (
        <StoreDetailContent id={id} />
      ))}
    </Suspense>
  );
}

async function StoreDetailContent({ id }: { id: string }) {
  const actor = await verifySession();
  // Tidak berhak = "tidak ditemukan", agar keberadaan toko lain tidak bocor.
  if (!canEditStore(actor, id)) notFound();
  const store = await getStore(id);
  if (!store) notFound();

  const isPlatformAdmin = can(actor, "store:manage");
  const [users, subscription, plans] = await Promise.all([
    listUsers({ storeId: store.id }),
    isPlatformAdmin ? getStoreSubscriptionState(store.id) : null,
    isPlatformAdmin ? listPlansForStore(store.id) : [],
  ]);
  const hasOwner = users.some((user) => user.isActive && user.role === "OWNER");
  const status = storeStatusOf(store);
  const opened = actor.activeStore?.id === store.id;

  return (
    <>
      {isPlatformAdmin && (
        <div>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/stores" />}>
            <ArrowLeftIcon />
            Daftar toko
          </Button>
        </div>
      )}
      <PageHeader
        title={store.name}
        description={isPlatformAdmin ? accessLabel(store, status) : (store.businessType ?? "Data toko")}
        action={
          <div className="flex items-center gap-2">
            <StoreStatusBadge status={isPlatformAdmin ? status : store.isActive ? "ACTIVE" : "INACTIVE"} />
            {isPlatformAdmin && <EnterStoreButton storeId={store.id} active={opened} />}
          </div>
        }
      />

      {isPlatformAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Pengguna toko</CardTitle>
            <CardDescription>
              {hasOwner
                ? "Untuk menambah pemilik/kasir, reset password, atau menonaktifkan akun, buka toko ini lalu pilih menu Pengguna."
                : "Toko ini belum punya pemilik. Buka toko lalu tambahkan akun Pemilik agar toko bisa dipakai."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!hasOwner && (
              <div>
                <EnterStoreButton storeId={store.id} variant="brand" redirectTo="/users/new?role=OWNER">
                  Buka toko & tambah pemilik
                </EnterStoreButton>
              </div>
            )}
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pengguna.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {users.map((user) => (
                  <li key={user.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <RoleBadge role={user.role} />
                      <UserStatusBadge user={user} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pengguna toko</CardTitle>
            <CardDescription>Kasir yang bekerja di toko Anda.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {can(actor, "user:manage-cashier") && (
                <Button variant="outline" nativeButton={false} render={<Link href="/users/new?role=CASHIER" />}>
                  <PlusIcon />
                  Tambah kasir
                </Button>
              )}
              <Button variant="ghost" nativeButton={false} render={<Link href="/users" />}>
                <UsersIcon />
                Kelola pengguna
              </Button>
            </div>
            <UsersTable users={users} showStore={false} />
          </CardContent>
        </Card>
      )}

      {isPlatformAdmin && subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Langganan</CardTitle>
            <CardDescription>
              {accessLabel(store, status)}.
              {subscription.open &&
                ` Ada tagihan ${PLAN_LABELS[subscription.open.months]} (${formatRupiah(subscription.open.price)}) ${
                  subscription.open.status === "UNDERPAID" ? "kurang bayar." : "menunggu konfirmasi."
                }`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" nativeButton={false} render={<Link href={`/billing?storeId=${store.id}`} />}>
                <CreditCardIcon />
                {subscription.open ? "Periksa tagihan toko ini" : "Riwayat tagihan toko ini"}
              </Button>
            </div>

            <div className="flex flex-col gap-2 border-t pt-6">
              <p className="text-sm font-medium">Harga khusus toko ini</p>
              <p className="text-sm text-muted-foreground">
                Isi hanya periode yang dinegosiasikan; periode lain tetap memakai harga standar.
              </p>
              <StorePricesForm storeId={store.id} plans={plans} />
            </div>

            <div className="flex flex-col gap-2 border-t pt-6">
              <p className="text-sm font-medium">Catat pembayaran langsung</p>
              <p className="text-sm text-muted-foreground">
                Untuk pemilik yang membayar tunai/transfer saat kunjungan. Langsung lunas dan masa aktif diperpanjang.
              </p>
              <AdminInvoiceForm storeId={store.id} plans={plans} hasPending={subscription.open != null} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Data toko</CardTitle>
          <CardDescription>Nama, jenis usaha, alamat, kontak, dan zona waktu.</CardDescription>
        </CardHeader>
        <CardContent>
          <StoreForm store={store} />
        </CardContent>
      </Card>

      {isPlatformAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Status toko</CardTitle>
            <CardDescription>Saklar manual, terpisah dari langganan: nonaktif = semua pengguna toko tidak bisa login.</CardDescription>
          </CardHeader>
          <CardContent>
            <StoreStatusActions store={store} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function StoreDetailSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-48 w-full" />
    </>
  );
}
