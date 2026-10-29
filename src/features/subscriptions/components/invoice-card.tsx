// Kartu tagihan terbuka di halaman Langganan (Pemilik), BUSINESS-FLOW §14.2:
// - PENDING : nominal, cara bayar (transfer / QRIS statis), form "Saya sudah
//             bayar" (bukti wajib), konfirmasi WhatsApp, batalkan. Bila klaim
//             sebelumnya ditolak admin, alasannya tampil di atas.
// - CLAIMED : "Menunggu konfirmasi" + waktu klaim + bukti; tidak bisa
//             dibatalkan pemilik (penyelesaian di tangan admin).
// Server Component; form & tombol adalah Client Component.

import { ClockIcon, FileCheckIcon, MessageCircleIcon, XCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import type { SubscriptionItem } from "@/features/subscriptions/queries";
import { whatsAppLink } from "@/features/subscriptions/service";
import { formatAccountNumber } from "@/lib/bank";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatRupiah } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { PlatformSettings } from "@/lib/platform-settings";
import { CancelInvoiceButton } from "./cancel-invoice-button";
import { ClaimPaymentForm } from "./claim-payment-form";
import { ProofPreview } from "./proof-preview";
import { SubscriptionStatusBadge } from "./subscription-badges";

export function InvoiceCard({
  invoice,
  settings,
  storeName,
}: {
  invoice: SubscriptionItem;
  settings: PlatformSettings;
  storeName: string;
}) {
  const claimed = invoice.status === "CLAIMED";
  const hasBank = settings.bankName && settings.bankAccountNumber;
  const message = claimed
    ? `Halo admin ${PRODUCT_NAME}, saya sudah mengirim bukti pembayaran langganan ${PLAN_LABELS[invoice.months]} (${formatRupiah(invoice.price)}) untuk toko ${storeName}. Mohon dikonfirmasi. Terima kasih.`
    : `Halo admin ${PRODUCT_NAME}, saya ingin membayar langganan ${PLAN_LABELS[invoice.months]} sebesar ${formatRupiah(invoice.price)} untuk toko ${storeName}.`;

  return (
    <Card className={claimed ? "border-sky-300 dark:border-sky-700" : "border-amber-300 dark:border-amber-700"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{claimed ? "Menunggu konfirmasi" : "Tagihan menunggu pembayaran"}</CardTitle>
          <SubscriptionStatusBadge status={invoice.status} />
        </div>
        <CardDescription>
          Paket {PLAN_LABELS[invoice.months]}, dibuat {invoice.createdAtLabel}.{" "}
          {claimed
            ? "Admin sedang mencocokkan pembayaran Anda dengan mutasi rekening. Masa aktif diperpanjang begitu ditandai lunas."
            : "Bayar lewat salah satu cara di bawah, lalu tekan “Saya sudah bayar” dan lampirkan buktinya."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!claimed && invoice.rejectionNote && (
          <Alert variant="destructive">
            <XCircleIcon />
            <AlertTitle>Klaim pembayaran sebelumnya ditolak{invoice.rejectedAtLabel ? ` (${invoice.rejectedAtLabel})` : ""}</AlertTitle>
            <AlertDescription>
              Alasan admin: {invoice.rejectionNote}. Periksa kembali transfer Anda, lalu kirim ulang bukti yang benar.
            </AlertDescription>
          </Alert>
        )}

        <div>
          <p className="text-sm text-muted-foreground">Jumlah yang dibayar</p>
          <p className="font-mono text-3xl font-semibold tabular-nums">{formatRupiah(invoice.price)}</p>
        </div>

        {claimed ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="flex items-center gap-2">
              <ClockIcon className="size-4 text-muted-foreground" />
              Dikirim {invoice.claimedAtLabel}
            </p>
            {invoice.note && <p className="text-muted-foreground">Catatan: {invoice.note}</p>}
            {invoice.proofType && (
              <div className="flex flex-col gap-2 pt-2">
                <p className="flex items-center gap-2">
                  <FileCheckIcon className="size-4 text-muted-foreground" />
                  Bukti transfer yang Anda kirim
                </p>
                <ProofPreview subscriptionId={invoice.id} type={invoice.proofType} className="self-start" />
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Transfer bank</p>
              {hasBank ? (
                <dl className="mt-2 text-sm">
                  <dt className="text-muted-foreground">Bank</dt>
                  <dd>{settings.bankName}</dd>
                  <dt className="mt-1 text-muted-foreground">Nomor rekening</dt>
                  <dd className="font-mono text-base tabular-nums">
                    {formatAccountNumber(settings.bankName, settings.bankAccountNumber ?? "")}
                  </dd>
                  <dt className="mt-1 text-muted-foreground">Atas nama</dt>
                  <dd>{settings.bankAccountName ?? "-"}</dd>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Rekening belum diatur. Hubungi admin.</p>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">QRIS</p>
              {settings.qrisImageKey ? (
                // eslint-disable-next-line @next/next/no-img-element -- gambar dilayani route /api/qris setelah cek login
                <img src="/api/qris" alt="QRIS SakuDagang" className="mt-2 w-full max-w-56 rounded-md border bg-white" />
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">QRIS belum tersedia. Gunakan transfer bank.</p>
              )}
            </div>
          </div>
        )}

        {!claimed && <ClaimPaymentForm subscriptionId={invoice.id} />}

        <div className="flex flex-wrap items-center gap-2">
          {settings.adminPhone ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={whatsAppLink(settings.adminPhone, message)} target="_blank" rel="noreferrer" />}
            >
              <MessageCircleIcon />
              Hubungi admin via WhatsApp ({formatPhone(settings.adminPhone)})
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Nomor WhatsApp admin belum diatur.</p>
          )}
          {!claimed && <CancelInvoiceButton subscriptionId={invoice.id} />}
        </div>
      </CardContent>
    </Card>
  );
}
