// Kartu tagihan yang menunggu pembayaran (halaman Langganan): nominal, cara
// bayar (transfer / QRIS statis), tombol konfirmasi via WhatsApp ke admin,
// dan tombol batalkan. Server Component; tombol batal adalah Client Component.

import { MessageCircleIcon } from "lucide-react";
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
  const hasBank = settings.bankName && settings.bankAccountNumber;
  const message = `Halo admin ${PRODUCT_NAME}, saya sudah membayar langganan ${PLAN_LABELS[invoice.months]} sebesar ${formatRupiah(invoice.price)} untuk toko ${storeName}. Mohon dikonfirmasi. Terima kasih.`;

  return (
    <Card className="border-amber-300 dark:border-amber-700">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Tagihan menunggu pembayaran</CardTitle>
          <SubscriptionStatusBadge status={invoice.status} />
        </div>
        <CardDescription>
          Paket {PLAN_LABELS[invoice.months]}, dibuat {invoice.createdAtLabel}. Setelah dibayar, konfirmasi ke admin
          agar langganan diaktifkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Jumlah yang dibayar</p>
          <p className="font-mono text-3xl font-semibold tabular-nums">{formatRupiah(invoice.price)}</p>
        </div>

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

        <div className="flex flex-wrap items-center gap-2">
          {settings.adminPhone ? (
            <Button nativeButton={false} render={<a href={whatsAppLink(settings.adminPhone, message)} target="_blank" rel="noreferrer" />}>
              <MessageCircleIcon />
              Konfirmasi via WhatsApp ({formatPhone(settings.adminPhone)})
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Nomor WhatsApp admin belum diatur.</p>
          )}
          <CancelInvoiceButton subscriptionId={invoice.id} />
        </div>
      </CardContent>
    </Card>
  );
}
