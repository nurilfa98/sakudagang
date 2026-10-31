// Pita di bawah header untuk Superadmin yang sedang membuka sebuah toko (pola
// sama dengan ArchiPay): mengingatkan data toko mana yang sedang dikelola,
// dengan tombol "Ganti" (ke daftar toko) dan "Keluar" (lepas toko aktif).
// Pemilik & Kasir tidak melihat pita ini (nama tokonya ada di header).
//
// Server Component: tombol memakai <form action> ke Server Action.

import { StoreIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { leaveStore } from "@/features/stores/actions";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

export function ActiveStoreBar({ user }: { user: CurrentUser }) {
  if (!user.activeStore || !can(user, "store:manage")) return null;
  const store = user.activeStore;

  return (
    <div className="border-b bg-brand/5">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-1.5 text-sm">
        <StoreIcon className="size-4 shrink-0 text-brand" />
        <span className="min-w-0 truncate">
          <span className="text-muted-foreground">Melihat toko </span>
          <span className="font-medium">{store.name}</span>
          {!store.isActive ? (
            <span className="text-muted-foreground"> (nonaktif)</span>
          ) : store.access.locked ? (
            <span className="text-rose-700 dark:text-rose-300"> (langganan habis)</span>
          ) : null}
        </span>
        <div className="ml-auto flex shrink-0 items-center">
          <Button variant="ghost" size="sm" className="h-7 px-2" nativeButton={false} render={<Link href="/stores" />}>
            Ganti
          </Button>
          <form action={leaveStore}>
            <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
              Keluar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
