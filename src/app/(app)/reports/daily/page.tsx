// Halaman /reports/daily: laporan satu hari (BUSINESS-FLOW §10.2), Pemilik.
// Angka §10.1, uang masuk per metode, barang terlaris, dan daftar transaksi.

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CashFlowSummary, ProfitSummary, TopProductsTable } from "@/features/reports/components/report-blocks";
import { ReportPeriodPicker } from "@/features/reports/components/report-period-picker";
import { getPeriodTotals, getTopProducts } from "@/features/reports/queries";
import { parseReportPeriod } from "@/features/reports/schemas";
import { dayRange, summarizePeriod } from "@/features/reports/service";
import { SalesTable } from "@/features/sales/components/sales-table";
import { listSales } from "@/features/sales/queries";
import { parseSaleFilters } from "@/features/sales/schemas";
import { requireStore } from "@/lib/auth/dal";
import { formatDate, zonedDateString } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Laporan Harian",
};

export default function DailyReportPage({ searchParams }: PageProps<"/reports/daily">) {
  return (
    <>
      <PageHeader title="Laporan" description="Omset, modal, laba, dan arus uang toko." />
      <Suspense fallback={<ReportSkeleton />}>
        <DailyReportContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DailyReportContent({ searchParams }: Pick<PageProps<"/reports/daily">, "searchParams">) {
  const actor = await requireStore("report:view");
  const params = await searchParams;
  const today = zonedDateString(new Date());
  const date = parseReportPeriod(params).date ?? today;
  const range = dayRange(date);

  const [totals, topProducts, sales] = await Promise.all([
    getPeriodTotals(actor.storeId, range),
    getTopProducts(actor.storeId, range),
    listSales(actor.storeId, { ...parseSaleFilters(params), date, withCost: true }),
  ]);
  const summary = summarizePeriod(totals);

  return (
    <>
      <ReportPeriodPicker mode="daily" date={date} years={[]} today={today} />
      <p className="text-sm text-muted-foreground">{formatDate(new Date(`${date}T12:00:00Z`))}</p>
      <ProfitSummary summary={summary} />
      <CashFlowSummary summary={summary} />
      <Card>
        <CardHeader>
          <CardTitle>Barang terlaris</CardTitle>
          <CardDescription>Jumlah terjual dan laba kotornya hari ini.</CardDescription>
        </CardHeader>
        <CardContent>
          <TopProductsTable products={topProducts} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Transaksi</CardTitle>
          <CardDescription>Penjualan yang dibatalkan tetap tampil (dicoret) tetapi tidak dihitung.</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesTable sales={sales} withCost filters={parseSaleFilters(params)} date={date} today={today} />
        </CardContent>
      </Card>
    </>
  );
}

function ReportSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-80" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
    </>
  );
}
