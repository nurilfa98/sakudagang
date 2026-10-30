// Halaman /stock-takes/[id]: lembar hitung (DRAFT) atau hasil opname
// (COMPLETED, tidak bisa diubah). Hanya Pemilik (stock-take:manage).

import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StockTakeResultTable, StockTakeStatusBadge } from "@/features/stock-takes/components/stock-take-parts";
import { StockTakeSheet } from "@/features/stock-takes/components/stock-take-sheet";
import { getStockTake } from "@/features/stock-takes/queries";
import { requireStore } from "@/lib/auth/dal";
import { formatRupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Detail Stok Opname",
};

export default function StockTakeDetailPage({ params }: PageProps<"/stock-takes/[id]">) {
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/stock-takes" />}>
          <ArrowLeftIcon />
          Daftar opname
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        {params.then(({ id }) => (
          <StockTakeDetailContent id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function StockTakeDetailContent({ id }: { id: string }) {
  const actor = await requireStore("stock-take:manage");
  const stockTake = await getStockTake(actor.storeId, id);
  // Opname toko lain = "tidak ditemukan".
  if (!stockTake) notFound();

  if (stockTake.status === "DRAFT") {
    return (
      <>
        <PageHeader
          title={<span className="font-mono">{stockTake.number}</span>}
          description={`Dimulai ${stockTake.createdAtLabel} oleh ${stockTake.createdByName}. Isi stok fisik; kosongkan barang yang tidak dihitung.`}
          action={<StockTakeStatusBadge status={stockTake.status} />}
        />
        <StockTakeSheet stockTakeId={stockTake.id} number={stockTake.number} items={stockTake.items} />
      </>
    );
  }

  const counted = stockTake.items.filter((item) => item.physicalQty !== null);
  const adjusted = counted.filter((item) => item.difference !== 0);

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{stockTake.number}</span>}
        description={`Selesai ${stockTake.completedAtLabel ?? stockTake.dateLabel}${stockTake.completedByName ? ` oleh ${stockTake.completedByName}` : ""}.`}
        action={<StockTakeStatusBadge status={stockTake.status} />}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Penyusutan" value={formatRupiah(stockTake.totalShrinkage ?? 0)} hint="Mengurangi laba bersih pada tanggal opname." />
        <Stat label="Barang disesuaikan" value={String(adjusted.length)} hint="Stok fisik berbeda dari sistem." />
        <Stat label="Barang dihitung" value={`${counted.length} / ${stockTake.items.length}`} hint="Yang tidak dihitung tidak berubah." />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Hasil hitung</CardTitle>
          <CardDescription>Selisih lebih hanya koreksi stok, tidak menambah laba.</CardDescription>
        </CardHeader>
        <CardContent>
          <StockTakeResultTable items={stockTake.items} />
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="font-mono text-2xl font-semibold tabular-nums">{value}</span>
        <CardDescription>{hint}</CardDescription>
      </CardContent>
    </Card>
  );
}
