// Daftar penjualan bon satu pelanggan: belum lunas dulu (tertua di atas),
// dengan tombol Bayar per bon. Tanpa pencarian/halaman (data table) karena
// barisnya per pelanggan sedikit.

import Link from "next/link";
import { ToneBadge } from "@/components/tone-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OVERDUE_DAYS } from "@/features/credits/constants";
import type { CreditSaleItem } from "@/features/credits/queries";
import { daysBetween } from "@/features/credits/service";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PayCreditButton } from "./pay-credit-button";

export function CreditSalesTable({
  sales,
  today,
  canPay,
}: {
  sales: CreditSaleItem[];
  today: string;
  canPay: boolean;
}) {
  if (sales.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Pelanggan ini belum pernah bon.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bon</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Total</TableHead>
          <TableHead className="hidden text-right md:table-cell">Dibayar</TableHead>
          <TableHead className="text-right">Sisa</TableHead>
          <TableHead className="w-20">
            <span className="sr-only">Aksi</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((sale) => {
          const age = daysBetween(sale.date, today);
          const open = sale.paymentStatus === "UNPAID";
          return (
            <TableRow key={sale.id}>
              <TableCell>
                <Link href={`/sales/${sale.id}`} className="font-mono font-medium hover:underline">
                  {sale.number}
                </Link>
                <p
                  className={cn(
                    "text-xs text-muted-foreground",
                    open && age > OVERDUE_DAYS && "font-medium text-amber-700 dark:text-amber-300",
                  )}
                >
                  {sale.dateLabel}
                  {open && ` · ${age} hari`}
                </p>
              </TableCell>
              <TableCell className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
                {formatRupiah(sale.total)}
              </TableCell>
              <TableCell className="hidden text-right whitespace-nowrap tabular-nums md:table-cell">
                {formatRupiah(sale.paid)}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {open ? (
                  <span className="font-medium text-amber-700 dark:text-amber-300">{formatRupiah(sale.remaining)}</span>
                ) : (
                  <ToneBadge tone="success">Lunas</ToneBadge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {open && canPay && <PayCreditButton sale={sale} today={today} />}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
