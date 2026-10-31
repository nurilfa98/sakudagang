// Penanda toko yang sedang dibuka, di navbar.
// - Pemilik/Kasir: nama toko + masa aktif ("Gratis s.d. 12 Nov"), agar batas
//   masa gratis/langganan terlihat sejak hari pertama (BUSINESS-FLOW §14.4).
// - Superadmin: tidak tampil; toko yang dibuka ditandai pita di bawah header
//   (active-store-bar.tsx) dengan tombol Ganti/Keluar.

import { StoreIcon } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatShortDate } from "@/lib/dates";
import type { StoreAccess } from "@/lib/subscription-access";
import { cn } from "@/lib/utils";

export function ActiveStoreIndicator({ user }: { user: CurrentUser }) {
  if (!user.activeStore || can(user, "store:manage")) return null;

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      <StoreIcon className="size-4 shrink-0 text-brand" />
      <span className="truncate font-medium">{user.activeStore.name}</span>
      <AccessUntil access={user.activeStore.access} />
    </div>
  );
}

// "Gratis s.d. 12 Nov" / "Aktif s.d. 12 Nov" / "Tenggang s.d. …" / "Habis".
// Amber bila ≤ 7 hari, merah bila tenggang/habis. Disembunyikan di layar sempit.
function AccessUntil({ access }: { access: StoreAccess }) {
  const label = access.locked
    ? "Langganan habis"
    : access.status === "GRACE"
      ? `Tenggang s.d. ${formatShortDate(access.graceUntil)}`
      : `${access.status === "TRIAL" ? "Gratis" : "Aktif"} s.d. ${formatShortDate(access.until)}`;
  return (
    <span
      className={cn(
        "hidden rounded-md border px-1.5 py-0.5 text-xs whitespace-nowrap md:inline",
        access.locked || access.status === "GRACE"
          ? "border-rose-200 text-rose-700 dark:border-rose-800 dark:text-rose-300"
          : access.needsReminder
            ? "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300"
            : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
