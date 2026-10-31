// Badge status toko (Masa gratis / Aktif / Tenggang / Habis / Nonaktif)
// dengan warna & ikon dari features/stores/status.ts. Dipakai kartu & detail toko.

import { ToneBadge } from "@/components/tone-badge";
import { STORE_STATUS, type StoreStatus } from "../status";

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  const { label, tone, icon: Icon } = STORE_STATUS[status];
  return (
    <ToneBadge tone={tone} className={status === "INACTIVE" ? "text-slate-900 dark:text-slate-100" : undefined}>
      <Icon />
      {label}
    </ToneBadge>
  );
}
