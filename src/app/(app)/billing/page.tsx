// Halaman /billing (Superadmin): semua tagihan langganan lintas toko.
// Tagihan menunggu konfirmasi (klaim bayar) tampil paling atas: lihat bukti,
// tandai lunas, atau tolak dengan alasan. Tagihan menunggu pembayaran bisa
// ditandai lunas atau dibatalkan.
// Filter ?storeId=&status=&year= (docs/ARCHITECTURE.md §3 "Daftar data").

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listStoreOptions } from "@/features/stores/queries";
import { SubscriptionsTable } from "@/features/subscriptions/components/subscriptions-table";
import { listSubscriptions, listSubscriptionYears } from "@/features/subscriptions/queries";
import { parseSubscriptionFilters } from "@/features/subscriptions/schemas";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Tagihan",
};

export default function BillingPage({ searchParams }: PageProps<"/billing">) {
  return (
    <>
      <PageHeader
        title="Tagihan langganan"
        description="Tagihan semua toko. Cocokkan mutasi rekening, lalu tandai lunas agar langganan toko diperpanjang."
      />
      <Suspense fallback={<BillingSkeleton />}>
        <BillingContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BillingContent({ searchParams }: Pick<PageProps<"/billing">, "searchParams">) {
  await requirePermission("subscription:manage");
  const filters = parseSubscriptionFilters(await searchParams, { allowStore: true });

  const [subscriptions, years, stores] = await Promise.all([
    listSubscriptions(filters),
    listSubscriptionYears(),
    listStoreOptions(),
  ]);

  return (
    <SubscriptionsTable
      subscriptions={subscriptions}
      platform
      filters={filters}
      years={years}
      storeOptions={stores.map((store) => ({ value: store.id, label: store.name }))}
    />
  );
}

function BillingSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-full max-w-xs" />
      <Skeleton className="h-64 w-full" />
    </>
  );
}
