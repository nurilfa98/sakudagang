// Halaman /reports/monthly: laporan satu bulan (BUSINESS-FLOW §10.3), Pemilik.
// Angka §10.1, grafik & tabel per hari, barang terlaris, laba per kategori,
// unduh Excel.

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
import { monthlyBreakdown, reportYears } from "@/features/reports/period";
import { getCategoryProfit, getPeriodTotals, getTopProducts } from "@/features/reports/queries";
import { parseReportPeriod } from "@/features/reports/schemas";
import { monthRange, summarizePeriod } from "@/features/reports/service";
import { requireStore } from "@/lib/auth/dal";
import { zonedDateString } from "@/lib/dates";
import { MONTH_NAMES } from "@/lib/format";

export const metadata: Metadata = {
  title: "Laporan Bulanan",
};

export default function MonthlyReportPage({ searchParams }: PageProps<"/reports/monthly">) {
  return (
    <>
      <PageHeader title="Laporan" description="Omset, modal, laba, dan arus uang toko." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <MonthlyReportContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function MonthlyReportContent({ searchParams }: Pick<PageProps<"/reports/monthly">, "searchParams">) {
  const actor = await requireStore("report:view");
  const today = zonedDateString(new Date());
  const [currentYear, currentMonth] = today.split("-").map(Number);
  const period = parseReportPeriod(await searchParams);
  const year = period.year ?? currentYear;
  const month = period.month ?? currentMonth;
  const range = monthRange(year, month);

  const [totals, breakdown, topProducts, categories, years] = await Promise.all([
    getPeriodTotals(actor.storeId, range),
    monthlyBreakdown(actor.storeId, year, month),
    getTopProducts(actor.storeId, range),
    getCategoryProfit(actor.storeId, range),
    reportYears(actor.storeId, currentYear, year),
  ]);
  const summary = summarizePeriod(totals);
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <>
      <ReportPeriodPicker
        mode="monthly"
        year={year}
        month={month}
        years={years}
        today={today}
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/api/reports/export?type=monthly&year=${year}&month=${month}`} download />}
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
          <CardTitle>Omset & laba bersih per hari</CardTitle>
          <CardDescription>{periodLabel}. Arahkan atau fokus ke satu hari untuk melihat angkanya.</CardDescription>
        </CardHeader>
        <CardContent>
          <ColumnChart
            ariaLabel={`Grafik omset dan laba bersih per hari, ${periodLabel}`}
            series={[{ name: "Omset" }, { name: "Laba bersih" }]}
            data={breakdown.map((row) => ({ label: row.label, tick: row.tick, values: [row.omset, row.netProfit] }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Rincian per hari</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakdownTable rows={breakdown} keyHeader="Tanggal" />
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
