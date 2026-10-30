// Halaman /reports/yearly: laporan satu tahun (BUSINESS-FLOW §10.3), Pemilik.
// Tabel & grafik per bulan untuk melihat bulan ramai/sepi, unduh Excel.

import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ColumnChart } from "@/components/charts/column-chart";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BreakdownTable,
  CashFlowSummary,
  CategoryProfitTable,
  ProfitSummary,
  TopProductsTable,
} from "@/features/reports/components/report-blocks";
import { ReportPeriodPicker } from "@/features/reports/components/report-period-picker";
import { reportYears, yearlyBreakdown } from "@/features/reports/period";
import { getCategoryProfit, getPeriodTotals, getTopProducts } from "@/features/reports/queries";
import { parseReportPeriod } from "@/features/reports/schemas";
import { summarizePeriod, yearRange } from "@/features/reports/service";
import { requireStore } from "@/lib/auth/dal";
import { zonedDateString } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Laporan Tahunan",
};

export default function YearlyReportPage({ searchParams }: PageProps<"/reports/yearly">) {
  return (
    <>
      <PageHeader title="Laporan" description="Omset, modal, laba, dan arus uang toko." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <YearlyReportContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function YearlyReportContent({ searchParams }: Pick<PageProps<"/reports/yearly">, "searchParams">) {
  const actor = await requireStore("report:view");
  const today = zonedDateString(new Date());
  const currentYear = Number(today.slice(0, 4));
  const year = parseReportPeriod(await searchParams).year ?? currentYear;
  const range = yearRange(year);

  const [totals, breakdown, topProducts, categories, years] = await Promise.all([
    getPeriodTotals(actor.storeId, range),
    yearlyBreakdown(actor.storeId, year),
    getTopProducts(actor.storeId, range),
    getCategoryProfit(actor.storeId, range),
    reportYears(actor.storeId, currentYear, year),
  ]);
  const summary = summarizePeriod(totals);

  return (
    <>
      <ReportPeriodPicker
        mode="yearly"
        year={year}
        years={years}
        today={today}
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/api/reports/export?type=yearly&year=${year}`} download />}
          >
            <DownloadIcon />
            Unduh Excel
          </Button>
        }
      />
      <ProfitSummary summary={summary} />
      <CashFlowSummary summary={summary} />
      <Card>
        <CardHeader>
          <CardTitle>Omset & laba bersih per bulan</CardTitle>
          <CardDescription>Tahun {year}. Arahkan atau fokus ke satu bulan untuk melihat angkanya.</CardDescription>
        </CardHeader>
        <CardContent>
          <ColumnChart
            ariaLabel={`Grafik omset dan laba bersih per bulan, tahun ${year}`}
            series={[{ name: "Omset" }, { name: "Laba bersih" }]}
            data={breakdown.map((row) => ({ label: row.label, tick: row.tick, values: [row.omset, row.netProfit] }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Rincian per bulan</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakdownTable rows={breakdown} keyHeader="Bulan" />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Barang terlaris</CardTitle>
            <CardDescription>10 barang dengan jumlah terjual terbanyak.</CardDescription>
          </CardHeader>
          <CardContent>
            <TopProductsTable products={topProducts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Laba per kategori</CardTitle>
            <CardDescription>Laba kotor dari penjualan, sebelum pengeluaran.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryProfitTable categories={categories} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
