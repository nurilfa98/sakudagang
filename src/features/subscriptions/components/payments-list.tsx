// Riwayat pembayaran satu tagihan (kartu Langganan pemilik & dialog admin):
// tiap bukti transfer dengan status (menunggu / diterima + nominal / ditolak +
// alasan) dan pratinjau bukti (kotak kecil → dialog). Tanpa nama pengguna.

import { ToneBadge } from "@/components/tone-badge";
import type { PaymentItem } from "@/features/subscriptions/queries";
import { formatRupiah } from "@/lib/format";
import { ProofPreview } from "./proof-preview";
import { PaymentStatusBadge } from "./subscription-badges";

export function PaymentsList({ payments }: { payments: PaymentItem[] }) {
  if (payments.length === 0) return null;
  return (
    <ol className="flex flex-col gap-3">
      {payments.map((payment, index) => (
        <li key={payment.id} className="flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          {payment.proofType ? (
            <ProofPreview paymentId={payment.id} type={payment.proofType} />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-white text-xs text-muted-foreground">
              Tanpa bukti
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Pembayaran {index + 1}</span>
              <PaymentStatusBadge status={payment.status} />
              {payment.status === "ACCEPTED" && payment.amountReceived != null && (
                <ToneBadge tone="success">Diterima {formatRupiah(payment.amountReceived)}</ToneBadge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Dikirim {payment.createdAtLabel}</p>
            {payment.note && <p className="text-muted-foreground">Catatan: {payment.note}</p>}
            {payment.status !== "PENDING" && payment.reviewNote && (
              <p className={payment.status === "REJECTED" ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}>
                {payment.status === "REJECTED" ? "Alasan ditolak: " : "Keterangan admin: "}
                {payment.reviewNote}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
