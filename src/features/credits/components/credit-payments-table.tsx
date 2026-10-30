// Riwayat pelunasan bon (per pelanggan atau per penjualan), terbaru dulu.
// Pelunasan yang dibatalkan tetap tampil (dicoret) beserta alasannya.
// Tombol batal hanya pada baris yang boleh dibatalkan user ini; server
// tetap memeriksa ulang.

import Link from "next/link";
import { ToneBadge } from "@/components/tone-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CREDIT_PAYMENT_METHOD_LABELS } from "@/features/credits/constants";
import type { CreditPaymentItem } from "@/features/credits/queries";
import { canVoidCreditPayment } from "@/features/credits/service";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VoidCreditPaymentButton } from "./void-credit-payment-button";

export function CreditPaymentsTable({
  payments,
  showSale,
  actor,
}: {
  payments: CreditPaymentItem[];
  showSale: boolean; // kolom nomor bon (di halaman pelanggan)
  actor: { id: string; canVoidAll: boolean; canSettle: boolean; today: string };
}) {
  if (payments.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada pelunasan.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tanggal</TableHead>
          {showSale && <TableHead className="hidden sm:table-cell">Bon</TableHead>}
          <TableHead>Metode</TableHead>
          <TableHead className="text-right">Nominal</TableHead>
          <TableHead className="hidden md:table-cell">Dicatat</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Aksi</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => {
          const voided = payment.status === "VOIDED";
          const canVoid =
            !voided &&
            actor.canSettle &&
            canVoidCreditPayment({ canVoidAll: actor.canVoidAll, actorId: actor.id, today: actor.today, payment });
          return (
            <TableRow key={payment.id}>
              <TableCell className="whitespace-nowrap">
                <span className={cn(voided && "text-muted-foreground line-through")}>{payment.dateLabel}</span>
                {voided && (
                  <p className="max-w-56 truncate text-xs text-muted-foreground" title={payment.voidReason ?? undefined}>
                    Dibatalkan: {payment.voidReason}
                  </p>
                )}
                {showSale && (
                  <Link href={`/sales/${payment.saleId}`} className="block font-mono text-xs hover:underline sm:hidden">
                    {payment.saleNumber}
                  </Link>
                )}
              </TableCell>
              {showSale && (
                <TableCell className="hidden sm:table-cell">
                  <Link href={`/sales/${payment.saleId}`} className="font-mono hover:underline">
                    {payment.saleNumber}
                  </Link>
                </TableCell>
              )}
              <TableCell>
                {voided ? (
                  <ToneBadge tone="danger">Dibatalkan</ToneBadge>
                ) : (
                  <ToneBadge tone={payment.paymentMethod === "QRIS" ? "active" : "pending"}>
                    {CREDIT_PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                  </ToneBadge>
                )}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium whitespace-nowrap tabular-nums",
                  voided && "text-muted-foreground line-through",
                )}
              >
                {formatRupiah(payment.amount)}
              </TableCell>
              <TableCell className="hidden text-sm whitespace-nowrap text-muted-foreground md:table-cell">
                {payment.createdByName}, {payment.createdAtLabel}
              </TableCell>
              <TableCell>{canVoid && <VoidCreditPaymentButton payment={payment} />}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
