// Badge status pembelian: Selesai = hijau, Dibatalkan = merah (components/tone-badge.tsx).

import { ToneBadge, type Tone } from "@/components/tone-badge";
import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "@/features/purchases/constants";

const TONES: Record<PurchaseStatus, Tone> = {
  COMPLETED: "success",
  VOIDED: "danger",
};

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  return <ToneBadge tone={TONES[status]}>{PURCHASE_STATUS_LABELS[status]}</ToneBadge>;
}
