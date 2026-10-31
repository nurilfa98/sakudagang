// Halaman /stores.
// - Superadmin: halaman pertama setelah login (pola sama dengan ArchiPay).
//   Kartu toko berwarna per status (features/stores/status.ts), diurutkan
//   dari yang perlu tindakan, dengan pencarian & saring status. Klik kartu =
//   detail toko, tombol "Buka" = masuk ke toko (kotak menu toko itu). Pita di
//   atas kartu mengingatkan tagihan yang menunggu konfirmasi.
// - Pemilik: langsung diarahkan ke halaman tokonya sendiri (/stores/[id]).
//
// Judul & tombol bergantung pada role, jadi seluruh isi ada di dalam <Suspense>.

import { ArrowRightIcon, PlusIcon, ReceiptTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreCard } from "@/features/stores/components/store-card";
import { StoreSearchList } from "@/features/stores/components/store-search";
import { listStores } from "@/features/stores/queries";
import { compareStores, isExpiringSoon, storeStatusOf } from "@/features/stores/status";
import { countPendingSubscriptions } from "@/features/subscriptions/queries";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Toko",
};

export default function StoresPage() {
  return (
    <Suspense fallback={<StoresSkeleton />}>
      <StoresContent />
    </Suspense>
  );
}

async function StoresContent() {
  const user = await verifySession();

  if (!can(user, "store:manage")) {
    // Pemilik/Kasir: hanya tokonya sendiri.
    redirect(user.storeId ? `/stores/${user.storeId}` : "/");
  }

  const [stores, pendingInvoices] = await Promise.all([listStores(), countPendingSubscriptions()]);

  return (
    <>
      <PageHeader
        title="Toko"
        description="Klien SakuDagang. Klik kartu untuk detail, atau Buka untuk mengelola menu tokonya."
        action={
          <Button nativeButton={false} render={<Link href="/stores/new" />}>
            <PlusIcon />
            Tambah toko
          </Button>
        }
      />

      {pendingInvoices > 0 && (
        <Alert className="border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
          <ReceiptTextIcon />
          <AlertTitle>{pendingInvoices} tagihan menunggu konfirmasi</AlertTitle>
          <AlertDescription>Cocokkan dengan mutasi rekening, lalu terima atau tolak pembayarannya.</AlertDescription>
          <AlertAction>
            <Button size="sm" nativeButton={false} render={<Link href="/billing" />}>
              Buka Tagihan
              <ArrowRightIcon />
            </Button>
          </AlertAction>
        </Alert>
      )}

      {stores.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-lg border border-dashed p-6 text-sm">
          <p className="font-medium">Belum ada toko.</p>
          <p className="text-muted-foreground">
            Klik &quot;Tambah toko&quot;, lalu buka tokonya dan tambahkan akun Pemilik di menu Pengguna.
          </p>
        </div>
      ) : (
        <StoreSearchList
          entries={[...stores].sort(compareStores).map((store) => {
            const status = storeStatusOf(store);
            return {
              key: store.id,
              searchText: `${store.name} ${store.ownerNames.join(" ")} ${store.businessType ?? ""}`,
              status,
              soon: isExpiringSoon(store),
              card: <StoreCard store={store} status={status} opened={store.id === user.activeStore?.id} />,
            };
          })}
        />
      )}
    </>
  );
}

function StoresSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </>
  );
}
