// Halaman /stores/[id]: data toko, pengguna toko, dan status (Superadmin).
// Pemilik hanya bisa membuka tokonya sendiri (canEditStore).
//
// [id] adalah dynamic segment. Dengan cacheComponents, nilai params baru
// diketahui saat request, jadi aksesnya wajib di dalam <Suspense>.
//
// Referensi:
// - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
// - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md

import { ArrowLeftIcon, CreditCardIcon, PlusIcon, TagIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreForm } from "@/features/stores/components/store-form";
import { StoreStatusActions } from "@/features/stores/components/store-status-actions";
import { StoreStatusBadge } from "@/features/stores/components/store-status-badge";
import { getStore } from "@/features/stores/queries";
import { canEditStore } from "@/features/stores/service";
import { AdminInvoiceForm } from "@/features/subscriptions/components/admin-invoice-form";
import { StoreAccessBadge } from "@/features/subscriptions/components/subscription-badges";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import { getStoreSubscriptionState, listPlansForStore } from "@/features/subscriptions/queries";
import { UsersTable } from "@/features/users/components/users-table";
import { listUsers } from "@/features/users/queries";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/dates";
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
        description={store.businessType ?? "Data toko"}
        action={<StoreStatusBadge isActive={store.isActive} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Data toko</CardTitle>
          <CardDescription>Nama, jenis usaha, alamat, kontak, dan zona waktu.</CardDescription>
        </CardHeader>
        <CardContent>
          <StoreForm store={store} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pengguna toko</CardTitle>
          <CardDescription>
            {isPlatformAdmin
              ? hasOwner
                ? "Pemilik dan kasir yang terdaftar di toko ini."
                : "Toko ini belum punya pemilik. Tambahkan akun Pemilik agar toko bisa dipakai."
              : "Kasir yang bekerja di toko Anda."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {can(actor, "user:manage-owner") && (
              <Button
                variant={hasOwner ? "outline" : "brand"}
                nativeButton={false}
                render={<Link href={`/users/new?storeId=${store.id}&role=OWNER`} />}
              >
                <PlusIcon />
                Tambah pemilik
              </Button>
            )}
            {can(actor, "user:manage-cashier") && (
              <Button variant="outline" nativeButton={false} render={<Link href={`/users/new?storeId=${store.id}&role=CASHIER`} />}>
                <PlusIcon />
                Tambah kasir
              </Button>
            )}
            <Button variant="ghost" nativeButton={false} render={<Link href={`/users?storeId=${store.id}`} />}>
              <UsersIcon />
              Kelola pengguna
            </Button>
          </div>
          <UsersTable users={users} showStore={false} />
        </CardContent>
      </Card>

      {isPlatformAdmin && subscription && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Langganan</CardTitle>
                <CardDescription>
                  {subscription.access.locked
                    ? `Habis sejak ${formatDate(subscription.access.until)}; akses toko terkunci.`
                    : `Berlaku sampai ${formatDate(subscription.access.until)}.`}
                  {subscription.open &&
                    ` Ada tagihan ${PLAN_LABELS[subscription.open.months]} (${formatRupiah(subscription.open.price)}) ${
                      subscription.open.status === "UNDERPAID" ? "kurang bayar." : "menunggu konfirmasi."
                    }`}
                </CardDescription>
              </div>
              <StoreAccessBadge status={subscription.access.status} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Harga untuk toko ini</p>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                {plans.map((plan) => (
                  <div key={plan.months} className="rounded-lg border p-3">
                    <dt className="text-muted-foreground">{PLAN_LABELS[plan.months]}</dt>
                    <dd className="font-mono font-semibold tabular-nums">{plan.price > 0 ? formatRupiah(plan.price) : "-"}</dd>
                    {plan.custom && <dd className="text-xs text-sky-700 dark:text-sky-300">Harga khusus</dd>}
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" nativeButton={false} render={<Link href={`/settings/stores/${store.id}`} />}>
                  <TagIcon />
                  Atur harga khusus
                </Button>
                {subscription.open && (
                  <Button variant="ghost" nativeButton={false} render={<Link href={`/billing?storeId=${store.id}`} />}>
                    <CreditCardIcon />
                    Lihat tagihan
                  </Button>
                )}
              </div>
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
