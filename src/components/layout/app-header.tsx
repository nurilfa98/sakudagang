// Header di bagian atas setiap halaman setelah login. Isinya dibatasi
// container yang sama dengan konten, sehingga sejajar di tengah layar.
//
//   [logo] | Menu > Barang        [toko aktif] [tema] [menu user]
//
// - Logo kembali ke kotak menu di /.
// - `sticky top-0`: header tetap terlihat saat halaman di-scroll.
// - [toko aktif] (slot `storeIndicator`): nama toko + masa aktif untuk
//   Pemilik & Kasir. Superadmin memakai pita di bawah header (ActiveStoreBar).
// - [tema] (ThemeToggle): pilihan Terang / Gelap / Sistem.
// - Menu user diterima lewat prop `userMenu` (slot) agar layout bisa
//   membungkusnya dengan <Suspense>.
// - Breadcrumb diterima lewat slot `breadcrumb`: isinya bergantung pada role
//   (halaman platform Superadmin tanpa "Menu") dan URL, jadi layout
//   membungkusnya dengan <Suspense>.
//   Referensi: https://nextjs.org/docs/messages/blocking-prerender-client-hook

import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { Brand } from "./brand";

export function AppHeader({
  breadcrumb,
  userMenu,
  storeIndicator,
}: {
  breadcrumb: ReactNode;
  userMenu: ReactNode;
  storeIndicator: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link
          href="/"
          aria-label="Kembali ke menu"
          className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Brand compact />
        </Link>
        <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-center" />
        {breadcrumb}
        <div className="ml-auto flex min-w-0 items-center gap-1">
          {storeIndicator}
          <ThemeToggle />
          {userMenu}
        </div>
      </div>
    </header>
  );
}
