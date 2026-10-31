// Aturan warna & ikon status toko (kartu, badge, chip saring di halaman Toko
// Superadmin), sama dengan aturan kartu company di ArchiPay. Satu status =
// satu warna = satu ikon, mengikuti aturan warna di components/tone-badge.tsx,
// sehingga Superadmin cukup melihat warna kartu untuk tahu keadaan klien:
//
//   Masa gratis = indigo  (active)  : sedang mencoba, belum berlangganan
//   Aktif       = emerald (success) : berlangganan, aman
//   Tenggang    = amber   (warning) : masa aktif habis, masih bisa dipakai
//   Habis       = rose    (danger)  : lewat masa tenggang, akses dikunci
//   Nonaktif    = slate   (pending) : dimatikan Superadmin
//
// Kartu memakai kelas .status-accent (globals.css) dengan hue status di
// bawah ini. Status dihitung dari masa langganan (lib/subscription-access.ts)
// + saklar Nonaktif (stores.is_active).

import {
  BadgeCheckIcon,
  GiftIcon,
  HourglassIcon,
  LockIcon,
  PowerOffIcon,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Tone } from "@/components/tone-badge";
import type { StoreAccess } from "@/lib/subscription-access";

export const STORE_STATUSES = ["TRIAL", "ACTIVE", "GRACE", "EXPIRED", "INACTIVE"] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

type StatusStyle = {
  label: string;
  description: string;
  tone: Tone;
  icon: LucideIcon;
  // Hue oklch untuk .status-accent; null = abu-abu.
  hue: number | null;
  // Warna titik di chip saring.
  dotClass: string;
  // Chip saring tetap tampil walau jumlahnya 0.
  alwaysInFilter: boolean;
  // Urutan kartu: yang perlu tindakan Superadmin dulu.
  rank: number;
};

export const STORE_STATUS: Record<StoreStatus, StatusStyle> = {
  TRIAL: {
    label: "Masa gratis",
    description: "Sedang mencoba, belum berlangganan",
    tone: "active",
    icon: GiftIcon,
    hue: 277,
    dotClass: "bg-indigo-500",
    alwaysInFilter: true,
    rank: 3,
  },
  ACTIVE: {
    label: "Aktif",
    description: "Berlangganan",
    tone: "success",
    icon: BadgeCheckIcon,
    hue: 163,
    dotClass: "bg-emerald-500",
    alwaysInFilter: true,
    rank: 3,
  },
  GRACE: {
    label: "Tenggang",
    description: "Masa aktif habis, belum dikunci",
    tone: "warning",
    icon: HourglassIcon,
    hue: 70,
    dotClass: "bg-amber-500",
    alwaysInFilter: false,
    rank: 1,
  },
  EXPIRED: {
    label: "Habis",
    description: "Belum memperpanjang, akses dikunci",
    tone: "danger",
    icon: LockIcon,
    hue: 16,
    dotClass: "bg-rose-500",
    alwaysInFilter: false,
    rank: 0,
  },
  INACTIVE: {
    label: "Nonaktif",
    description: "Dimatikan Superadmin",
    tone: "pending",
    icon: PowerOffIcon,
    hue: null,
    dotClass: "bg-slate-400",
    alwaysInFilter: true,
    rank: 4,
  },
};

type WithAccess = { name: string; isActive: boolean; access: StoreAccess };

// Status toko: Nonaktif (saklar manual) mengalahkan status langganan.
export function storeStatusOf(store: Pick<WithAccess, "isActive" | "access">): StoreStatus {
  return store.isActive ? store.access.status : "INACTIVE";
}

// "Segera habis": masa gratis/langganan tinggal ≤ 7 hari (belum tenggang).
export function isExpiringSoon(store: Pick<WithAccess, "isActive" | "access">) {
  const status = storeStatusOf(store);
  return (status === "TRIAL" || status === "ACTIVE") && store.access.needsReminder;
}

// Habis → tenggang → segera habis → lainnya → nonaktif; lalu yang paling
// dekat habis, lalu nama.
export function compareStores(a: WithAccess, b: WithAccess) {
  const rank = (store: WithAccess) => (isExpiringSoon(store) ? 2 : STORE_STATUS[storeStatusOf(store)].rank);
  return rank(a) - rank(b) || a.access.until.getTime() - b.access.until.getTime() || a.name.localeCompare(b.name);
}

export function storeAccentStyle(status: StoreStatus): CSSProperties {
  const { hue } = STORE_STATUS[status];
  const vars: Record<string, number> =
    hue === null ? { "--status-hue": 260, "--status-chroma": 0 } : { "--status-hue": hue };
  return vars as CSSProperties;
}
