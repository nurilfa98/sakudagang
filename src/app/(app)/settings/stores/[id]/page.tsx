// Halaman /settings/stores/[id] (Superadmin): harga khusus langganan satu toko.
// Dibuka dari Pengaturan (tabel harga khusus) atau detail toko.

import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStore } from "@/features/stores/queries";
import { StorePricesForm } from "@/features/subscriptions/components/store-prices-form";
import { listPlansForStore } from "@/features/subscriptions/queries";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Harga Khusus Toko",
};

export default function StorePricesPage({ params }: PageProps<"/settings/stores/[id]">) {
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/settings" />}>
          <ArrowLeftIcon />
          Pengaturan
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        {params.then(({ id }) => (
          <StorePricesContent id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function StorePricesContent({ id }: { id: string }) {
  await requirePermission("settings:manage");
  const store = await getStore(id);
  if (!store) notFound();
  const plans = await listPlansForStore(store.id);

  return (
    <>
      <PageHeader title={`Harga khusus: ${store.name}`} description="Harga total per periode untuk toko ini saja." />
      <Card>
        <CardHeader>
          <CardTitle>Harga langganan</CardTitle>
          <CardDescription>
            Isi hanya periode yang dinegosiasikan; periode lain tetap memakai harga standar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StorePricesForm storeId={store.id} plans={plans} cancelHref={`/stores/${store.id}`} />
        </CardContent>
      </Card>
    </>
  );
}
