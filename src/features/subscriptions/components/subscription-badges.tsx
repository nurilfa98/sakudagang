// Badge status akses toko & status tagihan. Dipakai server dan browser.

import { ToneBadge, type Tone } from "@/components/tone-badge";
import type { StoreAccessStatus } from "@/lib/subscription-access";
import {
  PAYMENT_STATUS_LABELS,
  STORE_ACCESS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type PaymentStatus,
  type SubscriptionStatus,
} from "../constants";

// Gratis = biru (sedang berjalan), aktif = hijau, tenggang = amber, habis = merah.
const ACCESS_TONES: Record<StoreAccessStatus, Tone> = {
  TRIAL: "active",
  ACTIVE: "success",
  GRACE: "warning",
  EXPIRED: "danger",
};

export function StoreAccessBadge({ status }: { status: StoreAccessStatus }) {
  return <ToneBadge tone={ACCESS_TONES[status]}>{STORE_ACCESS_LABELS[status]}</ToneBadge>;
}

const SUBSCRIPTION_TONES: Record<SubscriptionStatus, Tone> = {
  CLAIMED: "active",
  UNDERPAID: "warning",
  ACTIVE: "success",
  REJECTED: "danger",
  PENDING: "warning",
  CANCELLED: "pending",
};

const PAYMENT_TONES: Record<PaymentStatus, Tone> = {
  PENDING: "active",
  ACCEPTED: "success",
  REJECTED: "danger",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <ToneBadge tone={PAYMENT_TONES[status]}>{PAYMENT_STATUS_LABELS[status]}</ToneBadge>;
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <ToneBadge tone={SUBSCRIPTION_TONES[status]}>{SUBSCRIPTION_STATUS_LABELS[status]}</ToneBadge>;
}
