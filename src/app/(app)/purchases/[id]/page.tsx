// Halaman /purchases/[id]: detail satu pembelian (barang, harga beli, jejak
// harga modal) dan tombol pembatalan. Hanya Pemilik (purchase:manage).

import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchaseItemsTable } from "@/features/purchases/components/purchase-items-table";
import { PurchaseStatusBadge } from "@/features/purchases/components/purchase-status-badge";
import { VoidPurchaseAction } from "@/features/purchases/components/void-purchase-action";
import { getPurchase } from "@/features/purchases/queries";
import { requireStore } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Detail Pembelian",
};

export default function PurchaseDetailPage({ params }: PageProps<"/purchases/[id]">) {
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/purchases" />}>
          <ArrowLeftIcon />
          Daftar pembelian
        </Button>
      </div>
      <Suspense fallback={<PurchaseDetailSkeleton />}>
        {params.then(({ id }) => (
          <PurchaseDetailContent id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function PurchaseDetailContent({ id }: { id: string }) {
  const actor = await requireStore("purchase:manage");
  const purchase = await getPurchase(actor.storeId, id);
  // Pembelian toko lain = "tidak ditemukan".
  if (!purchase) notFound();

  const voided = purchase.status === "VOIDED";

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{purchase.number}</span>}
        description={`${purchase.dateLabel} · dicatat ${purchase.createdByName}, ${purchase.createdAtLabel}`}
        action={<PurchaseStatusBadge status={purchase.status} />}
      />

      {voided && (
        <Alert variant="destructive">
          <AlertTitle>
            Dibatalkan {purchase.voidedByName ? `oleh ${purchase.voidedByName}` : ""}, {purchase.voidedAtLabel}
          </AlertTitle>
          <AlertDescription>
            Alasan: {purchase.voidReason}. Stok sudah dikurangi kembali dan harga modal dihitung ulang; pembelian
            ini tidak dihitung di laporan.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Barang dibeli</CardTitle>
          <CardDescription>{purchase.note ?? "Tanpa catatan."}</CardDescription>
        </CardHeader>
        <CardContent>
          <PurchaseItemsTable items={purchase.items} total={purchase.total} />
        </CardContent>
      </Card>

      {!voided && (
        <Card>
          <CardHeader>
            <CardTitle>Pembatalan</CardTitle>
            <CardDescription>
              Ditolak bila sebagian barangnya sudah terjual; koreksi seperti itu lewat stok opname.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VoidPurchaseAction purchaseId={purchase.id} number={purchase.number} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function PurchaseDetailSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-64 w-full" />
    </>
  );
}
