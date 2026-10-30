// Daftar menu sidebar. Saat membuat fitur/halaman baru, cukup tambahkan
// satu baris di sini; sidebar, judul navbar, dan tombol pintas di kartu toko
// (beranda Superadmin) otomatis mengikuti.
//
// `permission` (opsional) menentukan siapa yang melihat menu tersebut.
// Ini hanya soal tampilan: halamannya sendiri tetap wajib memanggil
// requirePermission() dari lib/auth/dal.ts.
//
// `scope` membedakan dua lapisan hierarki (docs/BUSINESS-FLOW.md §2):
//   Superadmin (platform) → Toko → Pemilik → Kasir
// - "platform": menu pengelolaan klien (daftar toko, semua pengguna). Untuk
//   Pemilik menu yang sama menampilkan data tokonya sendiri.
// - "store"   : menu operasional SATU toko (barang, kasir, laporan, …).
//   Halamannya memakai requireStore(), jadi untuk Superadmin hanya tampil
//   saat ia sudah masuk ke sebuah toko dari beranda.

import {
  CreditCardIcon,
  HouseIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  StoreIcon,
  TruckIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export type NavScope = "platform" | "store";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  scope: NavScope;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Utama",
    items: [{ title: "Beranda", href: "/", icon: HouseIcon, scope: "platform" }],
  },
  {
    // Transaksi harian toko; Kasir & Penjualan menyusul di grup ini.
    label: "Transaksi",
    items: [
      { title: "Pembelian", href: "/purchases", icon: TruckIcon, permission: "purchase:manage", scope: "store" },
    ],
  },
  {
    label: "Master Data",
    items: [{ title: "Barang", href: "/products", icon: PackageIcon, permission: "product:view", scope: "store" }],
  },
  {
    label: "Administrasi",
    items: [
      // Superadmin: daftar semua toko; Pemilik: data tokonya sendiri.
      { title: "Toko", href: "/stores", icon: StoreIcon, permission: "store:edit-own", scope: "platform" },
      // Superadmin: pengguna semua toko (atau toko aktif); Pemilik: kasirnya.
      { title: "Pengguna", href: "/users", icon: UsersIcon, permission: "user:manage-cashier", scope: "platform" },
      // Superadmin saja: tagihan langganan semua toko & pengaturan platform.
      { title: "Tagihan", href: "/billing", icon: ReceiptIcon, permission: "subscription:manage", scope: "platform" },
      { title: "Pengaturan", href: "/settings", icon: SettingsIcon, permission: "settings:manage", scope: "platform" },
    ],
  },
  {
    // Selalu paling bawah (BUSINESS-FLOW §14): status langganan toko & pilihan paket.
    label: "Langganan",
    items: [
      { title: "Langganan", href: "/subscription", icon: CreditCardIcon, permission: "subscription:view", scope: "store" },
    ],
  },
];

// Menu operasional toko, urut sesuai sidebar. Dipakai kartu toko di beranda
// Superadmin sebagai tombol "masuk ke toko langsung ke menu ini".
export const STORE_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) =>
  group.items.filter((item) => item.scope === "store"),
);

// Menu aktif: "/" hanya cocok persis, menu lain juga aktif di sub-halamannya
// (misal /users/123 tetap menyorot "Pengguna").
export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
