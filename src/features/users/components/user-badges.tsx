// Badge role & status pengguna. Dipakai tabel pengguna (Client Component)
// dan halaman detail pengguna (Server Component).

import { ToneBadge } from "@/components/tone-badge";
import { Badge } from "@/components/ui/badge";
import type { UserListItem } from "@/features/users/queries";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

// Warna role sengaja di luar palet arti uang (hijau = laba, amber = piutang,
// merah = rugi): Pemilik memakai sky (warna brand, pemegang toko), Kasir slate
// (netral, operasional), Superadmin violet (tidak pernah tampil di daftar).
const ROLE_BADGE_CLASSES: Record<UserListItem["role"], string> = {
  OWNER: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  CASHIER: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SUPERADMIN:
    "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
};

export function RoleBadge({ role, className }: { role: UserListItem["role"]; className?: string }) {
  return (
    <Badge variant="outline" className={cn("shrink-0", ROLE_BADGE_CLASSES[role], className)}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

// Aktif = hijau, Nonaktif = abu-abu, belum ganti password sementara = outline.
export function UserStatusBadge({ user }: { user: Pick<UserListItem, "isActive" | "mustChangePassword"> }) {
  if (!user.isActive) {
    return (
      <ToneBadge tone="pending" className="text-slate-900 dark:text-slate-100">
        Nonaktif
      </ToneBadge>
    );
  }
  if (user.mustChangePassword) return <Badge variant="outline">Menunggu login</Badge>;
  return <ToneBadge tone="success">Aktif</ToneBadge>;
}
