// Tabel baris satu pembelian di halaman detail: qty, harga beli, subtotal,
// jejak harga modal sebelum → sesudah, dan harga jual baru bila diubah.
// Tanpa pencarian/halaman (data table) karena barisnya sedikit.
// HP (< md): daftar baris (components/mobile-list.tsx).

import Link from "next/link";
import { DesktopTable, MobileList, MobileListItem, MobileListRow, MobileListTotal } from "@/components/mobile-list";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PurchaseItemDetail } from "@/features/purchases/queries";
import { formatRupiah } from "@/lib/format";

export function PurchaseItemsTable({ items, total }: { items: PurchaseItemDetail[]; total: number }) {
  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Barang</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Harga beli</TableHead>
          <TableHead className="text-right">Subtotal</TableHead>
          <TableHead className="hidden text-right md:table-cell">Harga modal</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Harga jual baru</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/products/${item.productId}`} className="font-medium hover:underline">
                {item.productName}
              </Link>
              <p className="text-xs text-muted-foreground sm:hidden">@ {formatRupiah(item.unitCost)}</p>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap tabular-nums">
              {item.qty.toLocaleString("id-ID")} {item.unit}
            </TableCell>
            <TableCell className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
              {formatRupiah(item.unitCost)}
            </TableCell>
            <TableCell className="text-right whitespace-nowrap font-medium tabular-nums">
              {formatRupiah(item.subtotal)}
            </TableCell>
            <TableCell className="hidden text-right whitespace-nowrap tabular-nums md:table-cell">
              <span className="text-muted-foreground">{formatRupiah(item.costPriceBefore)} →</span>{" "}
              {formatRupiah(item.costPriceAfter)}
            </TableCell>
            <TableCell className="hidden text-right whitespace-nowrap tabular-nums lg:table-cell">
              {item.newSellingPrice == null ? (
                <span className="text-muted-foreground">Tetap</span>
              ) : (
                formatRupiah(item.newSellingPrice)
              )}
            </TableCell>
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
          <TableCell className="hidden md:table-cell" />
          <TableCell className="hidden lg:table-cell" />
        </TableRow>
      </TableFooter>
    </Table>
  );

  return (
    <>
      <DesktopTable>{table}</DesktopTable>
      <MobileList>
        {items.map((item) => (
          <MobileListItem key={item.id}>
            <MobileListRow>
              <Link href={`/products/${item.productId}`} className="min-w-0 font-medium hover:underline">
                {item.productName}
              </Link>
              <span className="font-semibold whitespace-nowrap tabular-nums">{formatRupiah(item.subtotal)}</span>
            </MobileListRow>
            <span className="text-xs text-muted-foreground tabular-nums">
              {item.qty.toLocaleString("id-ID")} {item.unit} × {formatRupiah(item.unitCost)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              Modal {formatRupiah(item.costPriceBefore)} →{" "}
              <span className="text-foreground">{formatRupiah(item.costPriceAfter)}</span>
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              Harga jual{" "}
              {item.newSellingPrice == null ? (
                "tetap"
              ) : (
                <span className="text-foreground">baru {formatRupiah(item.newSellingPrice)}</span>
              )}
            </span>
          </MobileListItem>
        ))}
        <MobileListTotal label="Total" value={formatRupiah(total)} />
      </MobileList>
    </>
  );
}
