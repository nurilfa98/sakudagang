// Kotak menu di halaman / (tepat setelah login): kolom pencarian, lalu ikon
// menu yang boleh dibuka user. Pola sama dengan ArchiPay.
//
// Client Component karena pencarian disaring langsung di browser saat
// mengetik. Komponen ini menerima `role` dari server, bukan daftar menu,
// karena ikon lucide adalah fungsi yang tidak bisa dikirim dari Server
// Component ke Client Component.
//
// - Enter di kolom pencarian membuka menu pertama yang cocok.
// - Superadmin: hanya menu toko yang sedang dibuka (halaman ini mengarahkan
//   Superadmin tanpa toko aktif ke /stores). Toko, Tagihan, Pengaturan
//   platform ada di tab halaman platform, bukan di sini (nav-config.ts).
// - `storeLocked`: langganan toko habis (BUSINESS-FLOW §14.3). Menu tetap
//   tampil dengan ikon gembok, tetapi selain Langganan mengarah ke
//   /subscription?from=… yang menjelaskan menu itu belum bisa dibuka.

"use client";

import { LockIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { MENU_ITEMS, SUPERADMIN_HIDDEN_MENUS, type MenuItem } from "./nav-config";

function matches(item: MenuItem, query: string) {
  const text = [item.title, item.description, ...(item.keywords ?? [])].join(" ").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

export function MenuLauncher({ role, storeLocked = false }: { role: Role; storeLocked?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const allowed = MENU_ITEMS.filter(
    (item) =>
      (!item.permission || can({ role }, item.permission)) &&
      !(role === "SUPERADMIN" && SUPERADMIN_HIDDEN_MENUS.includes(item.href)),
  );
  const visible = allowed.filter((item) => matches(item, query));
  const first = visible[0];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (first) router.push(hrefOf(first, storeLocked));
  }

  return (
    <div className="flex flex-col gap-6">
      <form role="search" onSubmit={handleSubmit} className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Cari menu"
          placeholder="Cari menu, misalnya: kasir, bon, stok"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 pl-9 text-base md:text-sm"
        />
      </form>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Menu &quot;{query}&quot; tidak ditemukan.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((item) => (
            <li key={item.href}>
              <MenuTile item={item} locked={storeLocked && item.href !== "/subscription"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MenuTile({ item, locked }: { item: MenuItem; locked: boolean }) {
  return (
    <Link
      href={hrefOf(item, locked)}
      className={cn(
        "group relative flex h-full flex-col items-center gap-3 rounded-xl border bg-card p-4 text-center outline-none transition-colors hover:border-brand/40 hover:bg-brand/5 focus-visible:ring-2 focus-visible:ring-ring sm:p-5",
        locked && "opacity-70",
      )}
    >
      {locked && <LockIcon className="absolute top-3 right-3 size-3.5 text-muted-foreground" aria-label="Terkunci" />}
      <span className="flex size-12 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
        <item.icon className="size-6" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{item.title}</span>
        <span className="text-xs text-muted-foreground">{item.description}</span>
      </span>
    </Link>
  );
}

// Toko terkunci: menu selain Langganan membuka halaman Langganan dengan
// penanda menu asal, agar pesannya spesifik ("Menu Barang …").
function hrefOf(item: MenuItem, locked: boolean) {
  if (!locked || item.href === "/subscription") return item.href;
  return `/subscription?from=${encodeURIComponent(item.href)}`;
}

export function MenuLauncherSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-11 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
