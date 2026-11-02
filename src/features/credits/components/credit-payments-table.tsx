// Riwayat pelunasan bon (per pelanggan atau per penjualan), terbaru dulu.
// Pelunasan yang dibatalkan tetap tampil (dicoret) beserta alasannya.
// Tombol batal hanya pada baris yang boleh dibatalkan user ini; server
// tetap memeriksa ulang. HP (< md): daftar baris (components/mobile-list.tsx).

import Link from "next/link";
import { DesktopTable, MobileList, MobileListItem, MobileListRow } from "@/components/mobile-list";
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

  const canVoidPayment = (payment: CreditPaymentItem) =>
    payment.status !== "VOIDED" &&
    actor.canSettle &&
    canVoidCreditPayment({ canVoidAll: actor.canVoidAll, actorId: actor.id, today: actor.today, payment });

  const table = (
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
          const canVoid = canVoidPayment(payment);
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

  return (
    <>
      <DesktopTable>{table}</DesktopTable>
      <MobileList>
        {payments.map((payment) => {
          const voided = payment.status === "VOIDED";
          return (
            <MobileListItem key={payment.id}>
              <MobileListRow>
                <div className="flex min-w-0 flex-col">
                  <span className={cn("font-medium", voided && "text-muted-foreground line-through")}>
                    {payment.dateLabel}
                  </span>
                  {showSale && (
                    <Link href={`/sales/${payment.saleId}`} className="font-mono text-xs hover:underline">
                      {payment.saleNumber}
                    </Link>
                  )}
                </div>
                <span
                  className={cn(
                    "font-semibold whitespace-nowrap tabular-nums",
                    voided && "text-muted-foreground line-through",
                  )}
                >
                  {formatRupiah(payment.amount)}
                </span>
              </MobileListRow>
              <MobileListRow className="items-center">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {voided ? (
                    <ToneBadge tone="danger">Dibatalkan</ToneBadge>
                  ) : (
                    <ToneBadge tone={payment.paymentMethod === "QRIS" ? "active" : "pending"}>
                      {CREDIT_PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                    </ToneBadge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {payment.createdByName}, {payment.createdAtLabel}
                  </span>
                </div>
                {canVoidPayment(payment) && <VoidCreditPaymentButton payment={payment} />}
              </MobileListRow>
              {voided && <p className="text-xs text-muted-foreground">Dibatalkan: {payment.voidReason}</p>}
            </MobileListItem>
          );
        })}
      </MobileList>
    </>
  );
}
