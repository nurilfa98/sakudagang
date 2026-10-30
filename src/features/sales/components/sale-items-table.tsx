// Tabel baris satu penjualan di halaman detail. Kolom harga modal & laba
// hanya bila nilainya dikirim server (Pemilik); untuk Kasir null.

import Link from "next/link";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SaleItemDetail } from "@/features/sales/queries";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SaleItemsTable({
  items,
  total,
  totalGrossProfit,
  linkProducts,
}: {
  items: SaleItemDetail[];
  total: number;
  totalGrossProfit: number | null;
  linkProducts: boolean; // detail barang hanya untuk Pemilik
}) {
  const withCost = totalGrossProfit != null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Barang</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Harga</TableHead>
          <TableHead className="text-right">Subtotal</TableHead>
          {withCost && <TableHead className="hidden text-right md:table-cell">Harga modal</TableHead>}
          {withCost && <TableHead className="hidden text-right md:table-cell">Laba kotor</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              {linkProducts ? (
                <Link href={`/products/${item.productId}`} className="font-medium hover:underline">
                  {item.productName}
                </Link>
              ) : (
                <span className="font-medium">{item.productName}</span>
              )}
              <p className="text-xs text-muted-foreground sm:hidden">@ {formatRupiah(item.sellingPrice)}</p>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap tabular-nums">
              {item.qty.toLocaleString("id-ID")} {item.unit}
            </TableCell>
            <TableCell className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
              {formatRupiah(item.sellingPrice)}
            </TableCell>
            <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
              {formatRupiah(item.subtotal)}
            </TableCell>
            {withCost && (
              <TableCell className="hidden text-right whitespace-nowrap tabular-nums md:table-cell">
                {item.costPrice == null ? "-" : formatRupiah(item.costPrice)}
              </TableCell>
            )}
            {withCost && (
              <TableCell
                className={cn(
                  "hidden text-right whitespace-nowrap tabular-nums md:table-cell",
                  (item.grossProfit ?? 0) < 0 && "text-rose-700 dark:text-rose-300",
                )}
              >
                {item.grossProfit == null ? "-" : formatRupiah(item.grossProfit)}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2} className="font-medium sm:hidden">
            Total
          </TableCell>
          <TableCell colSpan={3} className="hidden font-medium sm:table-cell">
            Total
          </TableCell>
          <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">{formatRupiah(total)}</TableCell>
          {withCost && <TableCell className="hidden md:table-cell" />}
          {withCost && (
            <TableCell className="hidden text-right font-semibold whitespace-nowrap tabular-nums md:table-cell">
              {formatRupiah(totalGrossProfit)}
            </TableCell>
          )}
        </TableRow>
      </TableFooter>
    </Table>
  );
}
