// Kartu tagihan terbuka di halaman Langganan pemilik (BUSINESS-FLOW §14.2):
// - Menunggu konfirmasi: ada pembayaran yang sedang diperiksa admin.
// - Kurang bayar: total diterima < harga; tampil kekurangan, cara bayar, dan
//   form "Saya sudah bayar" untuk bukti kekurangan pada tagihan yang sama.
// Selalu menampilkan riwayat pembayaran (bukti, nominal diterima, alasan
// tolak). Tidak ada tombol batalkan. Server Component.

import { MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import type { PaymentItem, SubscriptionItem } from "@/features/subscriptions/queries";
import { whatsAppLink } from "@/features/subscriptions/service";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatRupiah } from "@/lib/format";
import { ClaimPaymentForm } from "./claim-payment-form";
import { PaymentInstructions, type PaymentInfo } from "./payment-instructions";
import { PaymentsList } from "./payments-list";
import { SubscriptionStatusBadge } from "./subscription-badges";

export function InvoiceCard({
  invoice,
  payments,
  payment,
  storeName,
}: {
  invoice: SubscriptionItem;
  payments: PaymentItem[];
  payment: PaymentInfo;
  storeName: string;
}) {
  const underpaid = invoice.status === "UNDERPAID";
  const remaining = Math.max(invoice.price - invoice.amountPaid, 0);
  const message = underpaid
    ? `Halo admin ${PRODUCT_NAME}, saya akan melengkapi kekurangan ${formatRupiah(remaining)} untuk langganan ${PLAN_LABELS[invoice.months]} toko ${storeName}.`
    : `Halo admin ${PRODUCT_NAME}, saya sudah mengirim bukti pembayaran langganan ${PLAN_LABELS[invoice.months]} (${formatRupiah(invoice.price)}) untuk toko ${storeName}. Mohon dikonfirmasi. Terima kasih.`;

  return (
    <Card className={underpaid ? "border-amber-300 dark:border-amber-700" : "border-sky-300 dark:border-sky-700"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{underpaid ? "Kurang bayar" : "Menunggu konfirmasi"}</CardTitle>
          <SubscriptionStatusBadge status={invoice.status} />
        </div>
        <CardDescription>
          Paket {PLAN_LABELS[invoice.months]}, dibuat {invoice.createdAtLabel}.{" "}
          {underpaid
            ? "Pembayaran yang masuk belum mencukupi. Transfer kekurangannya, lalu kirim buktinya di bawah."
            : "Admin sedang mencocokkan pembayaran Anda dengan mutasi rekening; masa aktif diperpanjang begitu lunas."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Harga paket</dt>
            <dd className="font-mono text-xl font-semibold tabular-nums">{formatRupiah(invoice.price)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sudah diterima</dt>
            <dd className="font-mono text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatRupiah(invoice.amountPaid)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kekurangan</dt>
            <dd className="font-mono text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              {formatRupiah(remaining)}
            </dd>
          </div>
        </dl>

        <PaymentsList payments={payments} />

        {underpaid && (
          <>
            <PaymentInstructions payment={payment} />
            <ClaimPaymentForm subscriptionId={invoice.id} />
          </>
        )}

        {payment.adminPhone ? (
          <div>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={whatsAppLink(payment.adminPhone, message)} target="_blank" rel="noreferrer" />}
            >
              <MessageCircleIcon />
              Hubungi admin via WhatsApp
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nomor WhatsApp admin belum diatur.</p>
        )}
      </CardContent>
    </Card>
  );
}
