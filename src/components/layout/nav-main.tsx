// Daftar menu di sidebar.
//
// Client Component karena butuh usePathname() untuk menyorot menu aktif dan
// useSidebar() untuk menutup sidebar di HP setelah menu diklik.
//
// Komponen ini menerima `role` (string) dari server, bukan daftar menu.
// Alasannya: ikon lucide adalah fungsi, dan fungsi tidak bisa dikirim dari
// Server Component ke Client Component. Jadi daftar menu di-import langsung
// di sini, lalu difilter dengan can().
//
// Susunan menu mengikuti hierarki Superadmin → Toko → Pemilik → Kasir
// (docs/BUSINESS-FLOW.md §2):
// - Pemilik/Kasir: grup sesuai nav-config.ts (Utama, Master Data, …).
// - Superadmin: grup "Platform" (beranda, toko, pengguna) selalu tampil;
//   menu operasional toko hanya tampil setelah masuk ke sebuah toko, dalam
//   grup bernama toko itu. Tanpa toko aktif, halaman toko memang akan
//   mengarahkan kembali ke beranda (requireStore), jadi menunya disembunyikan.
//
// Referensi:
// - https://ui.shadcn.com/docs/components/sidebar
// - node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md

"use client";

import { LockIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { can } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";
import { isNavActive, NAV_GROUPS, type NavGroup } from "./nav-config";

// `storeLocked`: langganan toko habis (BUSINESS-FLOW §14.3). Menu tetap
// tampil, tetapi menu selain Langganan mengarah ke /subscription?from=…
// yang menjelaskan bahwa menu itu baru bisa dibuka setelah berlangganan.
export function NavMain({
  role,
  activeStoreName,
  storeLocked = false,
}: {
  role: Role;
  activeStoreName: string | null;
  storeLocked?: boolean;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const allowed = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can({ role }, item.permission)),
  }));

  const groups = (role === "SUPERADMIN" ? superadminGroups(allowed, activeStoreName) : allowed).filter(
    (group) => group.items.length > 0,
  );

  return groups.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel className="truncate">{group.label}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map((item) => (
          <SidebarMenuItem key={item.href}>
            {/* render={<Link />}: tombol dirender sebagai <a> milik Next.js.
                Ini pola Base UI (pengganti asChild di Radix). */}
            <SidebarMenuButton
              render={<Link href={lockedHref(item.href, storeLocked)} />}
              isActive={isNavActive(pathname, item.href)}
              tooltip={item.title}
              onClick={() => isMobile && setOpenMobile(false)}
              className={storeLocked && item.href !== "/subscription" ? "text-muted-foreground" : undefined}
            >
              <item.icon />
              <span>{item.title}</span>
              {storeLocked && item.href !== "/subscription" && <LockIcon className="ml-auto size-3.5" />}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ));
}

// Toko terkunci: semua menu (kecuali Langganan) membuka halaman Langganan
// dengan penanda menu asal, agar pesannya spesifik ("Menu Barang …").
function lockedHref(href: string, storeLocked: boolean) {
  if (!storeLocked || href === "/subscription") return href;
  return `/subscription?from=${encodeURIComponent(href)}`;
}

// Superadmin: dua grup, "Platform" dan "Toko: <nama>" (bila sedang masuk toko).
function superadminGroups(groups: NavGroup[], activeStoreName: string | null): NavGroup[] {
  const items = groups.flatMap((group) => group.items);
  const platform: NavGroup = { label: "Platform", items: items.filter((item) => item.scope === "platform") };
  if (!activeStoreName) return [platform];
  return [platform, { label: `Toko: ${activeStoreName}`, items: items.filter((item) => item.scope === "store") }];
}

// Ditampilkan oleh <Suspense> selama data user dimuat.
const SKELETON_WIDTHS = ["60%", "80%", "70%", "50%"];

export function NavMainSkeleton() {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {SKELETON_WIDTHS.map((width) => (
          <SidebarMenuItem key={width}>
            <SidebarMenuSkeleton showIcon width={width} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
