// Badge status toko. Dipakai tabel toko (Client Component) dan halaman detail
// toko (Server Component).

import { ToneBadge } from "@/components/tone-badge";

export function StoreStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <ToneBadge tone="success">Aktif</ToneBadge>
  ) : (
    <ToneBadge tone="pending" className="text-slate-900 dark:text-slate-100">
      Nonaktif
    </ToneBadge>
  );
}
