// Spanduk pengingat langganan di atas konten (semua halaman), BUSINESS-FLOW §14.4.
// - H-7 sebelum masa gratis/langganan habis: amber.
// - Masa tenggang: merah.
// - Terkunci: merah, Pemilik diarahkan ke halaman Langganan.
// Tidak tampil bila masih lama atau user tidak punya toko aktif.
// Kasir tidak bisa memperpanjang, jadi hanya diberi tahu.

import { AlertTriangleIcon, CreditCardIcon } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/dates";

export function SubscriptionBanner({ user }: { user: CurrentUser }) {
  const store = user.activeStore;
  if (!store || !(store.access.needsReminder || store.access.locked)) return null;
  const { access } = store;
  const canRenew = can(user, "subscription:view");

  const title = access.locked
    ? "Masa berlangganan toko habis"
    : access.status === "GRACE"
      ? `Masa tenggang sampai ${formatDate(access.graceUntil)}`
      : access.status === "TRIAL"
        ? `Masa gratis berakhir ${formatDate(access.until)}`
        : `Langganan berakhir ${formatDate(access.until)}`;

  const description = access.locked
    ? canRenew
      ? "Pilih paket dan lakukan pembayaran agar toko bisa dipakai kembali."
      : "Hubungi pemilik toko untuk memperpanjang langganan."
    : access.status === "GRACE"
      ? "Setelah masa tenggang lewat, toko tidak bisa dipakai sampai langganan diperpanjang."
      : `${Math.max(access.daysLeft, 0)} hari lagi. Perpanjang sekarang agar tidak terputus.`;

  return (
    <Alert variant={access.locked || access.status === "GRACE" ? "destructive" : "default"}>
      <AlertTriangleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>{description}</span>
        {canRenew && (
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/subscription" />}>
            <CreditCardIcon />
            Lihat paket
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
