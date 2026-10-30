// Blok tampilan laporan (Server Component): ringkasan §10.1, arus uang,
// tabel rincian per hari/bulan, barang terlaris, dan laba per kategori.
// Dipakai laporan harian, bulanan, tahunan.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CategoryProfit, TopProduct } from "@/features/reports/queries";
import type { BreakdownRow, PeriodSummary } from "@/features/reports/service";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

// Kotak laba-rugi: dari omset sampai laba bersih, urut seperti rumusnya.
export function ProfitSummary({ summary }: { summary: PeriodSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Figure label="Omset" value={summary.omset} hint={`${summary.transactionCount} transaksi, rata-rata ${formatRupiah(summary.averageTransaction)}.`} />
      <Figure label="HPP (uang modal)" value={summary.hpp} hint="Modal barang terjual; sisihkan untuk belanja stok lagi." />
      <Figure label="Laba kotor" value={summary.grossProfit} hint="Omset − HPP." signed />
      <Figure label="Pengeluaran" value={summary.expenses} hint="Biaya operasional di luar belanja stok." />
      <Figure label="Penyusutan" value={summary.shrinkage} hint="Barang hilang/rusak dari stok opname." />
      <Figure label="Laba bersih (uang laba)" value={summary.netProfit} hint="Laba kotor − pengeluaran − penyusutan." signed strong />
    </div>
  );
}

// Arus uang: uang masuk per metode, uang keluar, bon baru.
export function CashFlowSummary({ summary }: { summary: PeriodSummary }) {
  const rows: [string, number][] = [
    ["Penjualan tunai", summary.cashSales],
    ["Penjualan QRIS", summary.qrisSales],
    ["Pelunasan bon", summary.creditPayments],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Uang masuk</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <span className="font-mono text-2xl font-semibold">{formatRupiah(summary.cashIn)}</span>
          <dl className="flex flex-col gap-1 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular-nums">{formatRupiah(value)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Uang keluar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <span className="font-mono text-2xl font-semibold">{formatRupiah(summary.cashOut)}</span>
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Pembelian stok</dt>
              <dd className="tabular-nums">{formatRupiah(summary.purchases)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Pengeluaran</dt>
              <dd className="tabular-nums">{formatRupiah(summary.expenses)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Bon baru</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <span className="font-mono text-2xl font-semibold">{formatRupiah(summary.newCredit)}</span>
          <CardDescription>Omset yang belum jadi uang (sudah termasuk di omset).</CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  signed,
  strong,
}: {
  label: string;
  value: number;
  hint: string;
  signed?: boolean; // merah bila negatif (rugi)
  strong?: boolean;
}) {
  return (
    <Card className={cn(strong && "ring-2 ring-emerald-600/30")}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span
          className={cn(
            "font-mono text-2xl font-semibold",
            signed && value < 0 && "text-rose-700 dark:text-rose-300",
            strong && value >= 0 && "text-emerald-700 dark:text-emerald-300",
          )}
        >
          {formatRupiah(value)}
        </span>
        <CardDescription>{hint}</CardDescription>
      </CardContent>
    </Card>
  );
}

// Tabel per hari/bulan + baris total. Ini juga "tampilan tabel" untuk grafik
// di atasnya: semua angka grafik bisa dibaca tanpa hover.
export function BreakdownTable({ rows, keyHeader }: { rows: (BreakdownRow & { label: string })[]; keyHeader: string }) {
  const total = rows.reduce(
    (sum, row) => ({
      omset: sum.omset + row.omset,
      hpp: sum.hpp + row.hpp,
      grossProfit: sum.grossProfit + row.grossProfit,
      expenses: sum.expenses + row.expenses,
      shrinkage: sum.shrinkage + row.shrinkage,
      netProfit: sum.netProfit + row.netProfit,
    }),
    { omset: 0, hpp: 0, grossProfit: 0, expenses: 0, shrinkage: 0, netProfit: 0 },
  );
  const cells = (row: Omit<BreakdownRow, "key">) => (
    <>
      <TableCell className="text-right tabular-nums">{formatRupiah(row.omset)}</TableCell>
      <TableCell className="hidden text-right tabular-nums md:table-cell">{formatRupiah(row.hpp)}</TableCell>
      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatRupiah(row.grossProfit)}</TableCell>
      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatRupiah(row.expenses)}</TableCell>
      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatRupiah(row.shrinkage)}</TableCell>
      <TableCell className={cn("text-right font-medium tabular-nums", row.netProfit < 0 && "text-rose-700 dark:text-rose-300")}>
        {formatRupiah(row.netProfit)}
      </TableCell>
    </>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{keyHeader}</TableHead>
          <TableHead className="text-right">Omset</TableHead>
          <TableHead className="hidden text-right md:table-cell">HPP</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Laba kotor</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Pengeluaran</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Penyusutan</TableHead>
          <TableHead className="text-right">Laba bersih</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key} className={cn(row.omset === 0 && row.netProfit === 0 && "text-muted-foreground")}>
            <TableCell className="whitespace-nowrap">{row.label}</TableCell>
            {cells(row)}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Total</TableCell>
          {cells(total)}
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function TopProductsTable({ products }: { products: TopProduct[] }) {
  if (products.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada penjualan.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Barang</TableHead>
          <TableHead className="text-right">Terjual</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Omset</TableHead>
          <TableHead className="text-right">Laba kotor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.productId}>
            <TableCell className="font-medium">{product.productName}</TableCell>
            <TableCell className="text-right tabular-nums">{product.qty.toLocaleString("id-ID")}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatRupiah(product.omset)}</TableCell>
            <TableCell className={cn("text-right tabular-nums", product.grossProfit < 0 && "text-rose-700 dark:text-rose-300")}>
              {formatRupiah(product.grossProfit)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CategoryProfitTable({ categories }: { categories: CategoryProfit[] }) {
  if (categories.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada penjualan.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kategori</TableHead>
          <TableHead className="text-right">Omset</TableHead>
          <TableHead className="text-right">Laba kotor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.categoryName}>
            <TableCell className="font-medium">{category.categoryName}</TableCell>
            <TableCell className="text-right tabular-nums">{formatRupiah(category.omset)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatRupiah(category.grossProfit)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
