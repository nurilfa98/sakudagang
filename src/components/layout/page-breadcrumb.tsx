// Breadcrumb di header, diambil otomatis dari nav-config.ts berdasarkan URL
// yang sedang dibuka: "Menu > Barang".
//
// - "Menu" kembali ke kotak menu di / (disembunyikan di HP agar muat),
//   kecuali di halaman platform Superadmin (Toko, Tagihan, Pengaturan
//   platform) yang tidak berada di bawah kotak menu.
// - Di sub-halaman (misal /products/123) nama menu menjadi link untuk
//   kembali ke daftarnya.
//
// Referensi: https://ui.shadcn.com/docs/components/breadcrumb

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { isPlatformPath, matchesPath, MENU_ITEMS, PLATFORM_PAGES } from "./nav-config";

// `platformAdmin` = user Superadmin (dikirim dari layout).
export function PageBreadcrumb({ platformAdmin = false }: { platformAdmin?: boolean }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  const platformPage = platformAdmin && isPlatformPath(pathname);
  const item = platformPage
    ? PLATFORM_PAGES.find((page) => matchesPath(pathname, page.href))
    : MENU_ITEMS.find((menu) => matchesPath(pathname, menu.href));

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {!platformPage && (
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink render={<Link href="/" />}>Menu</BreadcrumbLink>
          </BreadcrumbItem>
        )}
        {item && (
          <>
            {!platformPage && <BreadcrumbSeparator className="hidden sm:inline-flex" />}
            <BreadcrumbItem className="min-w-0">
              {pathname === item.href ? (
                <BreadcrumbPage className="truncate font-medium">{item.title}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="truncate" render={<Link href={item.href} />}>
                  {item.title}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
