// Tab di halaman platform Superadmin: Toko · Tagihan · Pengaturan platform.
// Pengganti kotak menu, karena halaman platform tidak berada di bawah toko
// mana pun (pola sama dengan ArchiPay). `pending` = jumlah tagihan menunggu
// konfirmasi.
//
// Client Component karena butuh usePathname().

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { matchesPath, PLATFORM_PAGES } from "./nav-config";

export function PlatformNav({ pending }: { pending: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu platform" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b">
        {PLATFORM_PAGES.map((page) => {
          const active = matchesPath(pathname, page.href);
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {page.title}
                {page.href === "/billing" && pending > 0 && (
                  <span className="rounded-full bg-brand px-1.5 text-[11px] text-brand-foreground tabular-nums">
                    {pending}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
