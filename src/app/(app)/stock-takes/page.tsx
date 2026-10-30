// Halaman /stock-takes: daftar stok opname + tombol mulai / lanjutkan draf
// (Pemilik, stock-take:manage). BUSINESS-FLOW §9.

import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StartStockTakeButton, StockTakesList } from "@/features/stock-takes/components/stock-take-parts";
import { findDraftStockTake, listStockTakes } from "@/features/stock-takes/queries";
import { requireStore } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Stok Opname",
};

export default function StockTakesPage() {
  return (
    <Suspense fallback={<StockTakesSkeleton />}>
      <StockTakesContent />
    </Suspense>
  );
}

async function StockTakesContent() {
  const actor = await requireStore("stock-take:manage");
  const [stockTakes, draft] = await Promise.all([listStockTakes(actor.storeId), findDraftStockTake(actor.storeId)]);

  return (
    <>
      <PageHeader
        title="Stok opname"
        description="Mencocokkan stok fisik dengan sistem. Selisih kurang dicatat sebagai penyusutan (mengurangi laba)."
        action={
          draft ? (
            <Button nativeButton={false} render={<Link href={`/stock-takes/${draft.id}`} />}>
              Lanjutkan {draft.number}
              <ArrowRightIcon />
            </Button>
          ) : (
            <StartStockTakeButton />
          )
        }
      />
      <Card>
        <CardContent>
          <StockTakesList stockTakes={stockTakes} />
        </CardContent>
      </Card>
    </>
  );
}

function StockTakesSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-64 w-full" />
    </>
  );
}
