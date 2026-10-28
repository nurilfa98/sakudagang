// Daftar menu sidebar. Saat membuat fitur/halaman baru, cukup tambahkan
// satu baris di sini; sidebar dan judul navbar otomatis mengikuti.
//
// `permission` (opsional) menentukan siapa yang melihat menu tersebut.
// Ini hanya soal tampilan: halamannya sendiri tetap wajib memanggil
// requirePermission() dari lib/auth/dal.ts.

import { HouseIcon, type LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Utama",
    items: [{ title: "Beranda", href: "/", icon: HouseIcon }],
  },
  // Contoh grup berikutnya:
  // {
  //   label: "Master Data",
  //   items: [{ title: "Produk", href: "/products", icon: PackageIcon, permission: "product:view" }],
  // },
];

// Menu aktif: "/" hanya cocok persis, menu lain juga aktif di sub-halamannya
// (misal /products/123 tetap menyorot "Barang").
export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
