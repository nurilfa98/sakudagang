// Badge penjualan (components/tone-badge.tsx):
// - Status: Selesai = hijau, Dibatalkan = merah.
// - Metode: Tunai = netral, QRIS = indigo, Bon belum lunas = amber, Bon lunas = hijau.

import { ToneBadge, type Tone } from "@/components/tone-badge";
import {
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  type PaymentMethod,
  type SalePaymentStatus,
  type SaleStatus,
} from "@/features/sales/constants";

const STATUS_TONES: Record<SaleStatus, Tone> = {
  COMPLETED: "success",
  VOIDED: "danger",
};

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return <ToneBadge tone={STATUS_TONES[status]}>{SALE_STATUS_LABELS[status]}</ToneBadge>;
}

export function PaymentMethodBadge({
  method,
  paymentStatus,
}: {
  method: PaymentMethod;
  paymentStatus: SalePaymentStatus;
}) {
  if (method === "CREDIT") {
    return paymentStatus === "PAID" ? (
      <ToneBadge tone="success">Bon lunas</ToneBadge>
    ) : (
      <ToneBadge tone="warning">Bon</ToneBadge>
    );
  }
  return <ToneBadge tone={method === "QRIS" ? "active" : "pending"}>{PAYMENT_METHOD_LABELS[method]}</ToneBadge>;
}
