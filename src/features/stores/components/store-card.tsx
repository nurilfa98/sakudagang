// Kartu satu toko di halaman Toko (Superadmin). Server Component. Pola sama
// dengan kartu company di ArchiPay.
//
//   ┌──────────────────────────────────────┐
//   │ [ikon] Nama toko                 >   │  klik kartu = detail toko
//   │        Pemilik: Budi                 │  warna & ikon = status (status.ts)
//   ├──────────────────────────────────────┤
//   │ 3 pengguna · 120 barang              │
//   │ Gratis s.d. 14 Nov 2026 · 12 hari    │  masa aktif (merah/kuning bila perlu tindakan)
//   │ [Buka →]                 (Status)    │  Buka = masuk ke toko
//   └──────────────────────────────────────┘
//
// Seluruh kartu bisa diklik lewat link nama yang direntangkan
// (after:absolute inset-0), sedangkan tombol "Buka" diletakkan di atasnya
// (relative z-10) agar tetap bisa diklik sendiri.

import { CalendarClockIcon, ChevronRightIcon, PackageIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import type { StoreListItem } from "@/features/stores/queries";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { isExpiringSoon, STORE_STATUS, storeAccentStyle, type StoreStatus } from "../status";
import { EnterStoreButton } from "./enter-store-button";
import { StoreStatusBadge } from "./store-status-badge";

export function StoreCard({ store, status, opened }: { store: StoreListItem; status: StoreStatus; opened: boolean }) {
  const StatusIcon = STORE_STATUS[status].icon;
  return (
    <article
      style={storeAccentStyle(status)}
      className={cn(
        "status-accent group relative flex flex-col overflow-hidden rounded-xl bg-card text-sm ring-1 ring-(--status-border) transition-shadow focus-within:ring-2 focus-within:ring-(--status-strong) hover:ring-2 hover:ring-(--status-strong)",
        opened && "ring-2 ring-(--status-strong)",
      )}
    >
      <div className="flex items-center gap-3 border-b border-(--status-border) bg-(--status-soft) p-4">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-(--status-strong) text-(--status-on)"
          title={STORE_STATUS[status].description}
        >
          <StatusIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/stores/${store.id}`} className="block truncate font-semibold outline-none after:absolute after:inset-0">
            {store.name}
          </Link>
          <p
            className={cn(
              "truncate text-xs",
              store.ownerNames.length ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300",
            )}
          >
            {store.ownerNames.length ? `Pemilik: ${store.ownerNames.join(", ")}` : "Belum ada pemilik"}
          </p>
        </div>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon className="size-4 text-muted-foreground" />
              {store.userCount} pengguna
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PackageIcon className="size-4 text-muted-foreground" />
              {store.productCount} barang
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {store.businessType ? `${store.businessType} · ` : ""}Bergabung {formatShortDate(store.createdAt)}
          </p>
        </div>

        <p
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            status === "EXPIRED" && "text-rose-700 dark:text-rose-300",
            (status === "GRACE" || isExpiringSoon(store)) && "text-amber-700 dark:text-amber-300",
          )}
        >
          <CalendarClockIcon className="size-3.5 shrink-0" />
          {accessLabel(store, status)}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="relative z-10">
            <EnterStoreButton storeId={store.id} active={opened} size="sm" />
          </div>
          <StoreStatusBadge status={status} />
        </div>
      </div>
    </article>
  );
}

// Masa aktif satu baris, dipakai juga di detail toko.
export function accessLabel(store: Pick<StoreListItem, "access">, status: StoreStatus) {
  const { until, graceUntil, daysLeft } = store.access;
  const left = daysLeft <= 0 ? "berakhir hari ini" : `${daysLeft} hari lagi`;
  switch (status) {
    case "TRIAL":
      return `Gratis s.d. ${formatShortDate(until)} · ${left}`;
    case "ACTIVE":
      return `Aktif s.d. ${formatShortDate(until)} · ${left}`;
    case "GRACE":
      return `Habis ${formatShortDate(until)} · tenggang s.d. ${formatShortDate(graceUntil)}`;
    case "EXPIRED":
      return `Habis sejak ${formatShortDate(graceUntil)}, akses dikunci`;
    case "INACTIVE":
      return `Masa aktif s.d. ${formatShortDate(until)}`;
  }
}
