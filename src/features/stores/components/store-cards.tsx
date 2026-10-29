// Beranda Superadmin: satu kartu per toko (klien) dengan info ringkas dan
// tombol menu toko itu. Setiap tombol adalah <form> ke Server Action
// enterStore (set toko aktif → redirect ke menu), jadi Superadmin langsung
// "masuk" ke toko dan memakai semua menu seperti pemiliknya
// (hierarki Superadmin → Toko → Pemilik → Kasir, docs/BUSINESS-FLOW.md §2).
//
// Daftar tombol menu diambil dari nav-config.ts (STORE_NAV_ITEMS) ditambah
// "Pengguna" (menu platform, dibuka dengan filter ?storeId= toko itu).
// Fitur toko baru (kasir, pembelian, laporan) cukup ditambahkan di
// nav-config.ts dengan scope "store" dan akan muncul di sini.

import { CalendarIcon, SettingsIcon, StoreIcon, UsersIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { STORE_NAV_ITEMS } from "@/components/layout/nav-config";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { enterStore } from "@/features/stores/actions";
import type { StoreListItem } from "@/features/stores/queries";
import { StoreAccessBadge } from "@/features/subscriptions/components/subscription-badges";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

function storeMenus(storeId: string): { title: string; href: string; icon: LucideIcon }[] {
  return [
    ...STORE_NAV_ITEMS.map(({ title, href, icon }) => ({ title, href, icon })),
    { title: "Pengguna", href: `/users?storeId=${storeId}`, icon: UsersIcon },
  ];
}

export function StoreCards({ stores, activeStoreId }: { stores: StoreListItem[]; activeStoreId: string | null }) {
  if (stores.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Belum ada toko</CardTitle>
          <CardDescription>Buat toko pertama, lalu tambahkan akun pemiliknya.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/stores/new" />}>
            <StoreIcon />
            Tambah toko
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stores.map((store) => {
        const isCurrent = store.id === activeStoreId;
        return (
          <Card key={store.id} className={isCurrent ? "border-brand" : undefined}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                  <StoreIcon className="size-4" />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {isCurrent && <ToneBadge tone="active">Sedang dibuka</ToneBadge>}
                  {store.isActive ? (
                    <StoreAccessBadge status={store.access.status} />
                  ) : (
                    <ToneBadge tone="pending">Nonaktif</ToneBadge>
                  )}
                </div>
              </div>
              <CardTitle className="truncate">{store.name}</CardTitle>
              <CardDescription>{store.businessType ?? "Jenis usaha belum diisi"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Pemilik</dt>
                <dd className="truncate">
                  {store.ownerNames.length > 0 ? (
                    store.ownerNames.join(", ")
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">Belum ada</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Pengguna</dt>
                <dd className="tabular-nums">{store.userCount}</dd>
                <dt className="text-muted-foreground">Barang aktif</dt>
                <dd className="tabular-nums">{store.productCount}</dd>
                <dt className="text-muted-foreground">Bergabung</dt>
                <dd className="flex items-center gap-1 tabular-nums">
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  {formatShortDate(store.createdAt)}
                </dd>
                <dt className="text-muted-foreground">Langganan</dt>
                <dd
                  className={cn(
                    "tabular-nums",
                    store.access.locked && "font-medium text-rose-700 dark:text-rose-300",
                    !store.access.locked && store.access.needsReminder && "font-medium text-amber-700 dark:text-amber-300",
                  )}
                >
                  {store.access.locked ? "Habis sejak " : "s.d. "}
                  {formatShortDate(store.access.until)}
                </dd>
              </dl>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Masuk ke menu toko</span>
                <div className="flex flex-wrap gap-2">
                  {storeMenus(store.id).map((item) => (
                    <form key={item.href} action={enterStore}>
                      <input type="hidden" name="storeId" value={store.id} />
                      <input type="hidden" name="redirectTo" value={item.href} />
                      <Button type="submit" variant="outline" size="sm">
                        <item.icon />
                        {item.title}
                      </Button>
                    </form>
                  ))}
                  <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/stores/${store.id}`} />}>
                    <SettingsIcon />
                    Data toko
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
