// Daftar menu SakuDagang. Ditampilkan sebagai kotak ikon di halaman / (tepat
// setelah login) dan dipakai breadcrumb di header serta tombol pintas di
// kartu toko (beranda Superadmin). Saat membuat fitur/halaman baru, cukup
// tambahkan satu baris di MENU_ITEMS.
//
// `permission` (opsional) menentukan siapa yang melihat menu tersebut.
// Ini hanya soal tampilan: halamannya sendiri tetap wajib memanggil
// requirePermission() dari lib/auth/dal.ts.
//
// `scope` membedakan dua lapisan hierarki (docs/BUSINESS-FLOW.md §2):
//   Superadmin (platform) → Toko → Pemilik → Kasir
// - "platform": menu pengelolaan klien (beranda, daftar toko, semua pengguna).
//   Untuk Pemilik menu yang sama menampilkan data tokonya sendiri.
// - "store"   : menu operasional SATU toko (barang, kasir, laporan, …).
//   Halamannya memakai requireStore(), jadi untuk Superadmin hanya tampil
//   saat ia sudah membuka sebuah toko.
//
// Superadmin (pola sama dengan ArchiPay): setelah login langsung ke halaman
// Toko; Toko, Tagihan, dan Pengaturan platform berpindah lewat tab
// (PLATFORM_PAGES), bukan lewat kotak menu. Kotak menu Superadmin hanya
// berisi menu toko yang sedang dibuka (SUPERADMIN_MENU_HREFS tidak ikut).

import {
  ChartColumnIcon,
  ClipboardListIcon,
  CreditCardIcon,
  HandCoinsIcon,
  HouseIcon,
  PackageIcon,
  ReceiptIcon,
  ReceiptTextIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export type NavScope = "platform" | "store";

export type MenuItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  // Kata lain yang ikut dicocokkan oleh kolom pencarian menu.
  keywords?: string[];
  permission?: Permission;
  scope: NavScope;
};

// Urutan = urutan kotak di halaman menu.
export const MENU_ITEMS: MenuItem[] = [
  {
    title: "Beranda",
    href: "/beranda",
    icon: HouseIcon,
    description: "Ringkasan toko & penjualan",
    keywords: ["dashboard", "ringkasan", "omset", "dana"],
    scope: "platform",
  },
  {
    title: "Kasir",
    href: "/cashier",
    icon: ShoppingCartIcon,
    description: "Layar penjualan",
    keywords: ["jual", "pos", "transaksi", "struk"],
    permission: "sale:create",
    scope: "store",
  },
  {
    // Pemilik: semua transaksi; Kasir: transaksinya sendiri.
    title: "Penjualan",
    href: "/sales",
    icon: ReceiptTextIcon,
    description: "Riwayat transaksi",
    keywords: ["nota", "struk", "void", "batal"],
    permission: "sale:create",
    scope: "store",
  },
  {
    // Piutang pelanggan & pelunasan (Pemilik & Kasir).
    title: "Bon",
    href: "/credits",
    icon: HandCoinsIcon,
    description: "Piutang pelanggan",
    keywords: ["utang", "piutang", "kasbon", "pelanggan", "tagih"],
    permission: "credit:settle",
    scope: "store",
  },
  {
    title: "Pembelian",
    href: "/purchases",
    icon: TruckIcon,
    description: "Barang masuk dari pemasok",
    keywords: ["kulakan", "supplier", "pemasok", "stok masuk"],
    permission: "purchase:manage",
    scope: "store",
  },
  {
    title: "Pengeluaran",
    href: "/expenses",
    icon: WalletIcon,
    description: "Biaya operasional toko",
    keywords: ["biaya", "ongkos", "listrik", "gaji"],
    permission: "expense:manage",
    scope: "store",
  },
  {
    title: "Laporan",
    href: "/reports",
    icon: ChartColumnIcon,
    description: "Harian, bulanan, tahunan",
    keywords: ["omset", "laba", "rugi", "rekap"],
    permission: "report:view",
    scope: "store",
  },
  {
    title: "Barang",
    href: "/products",
    icon: PackageIcon,
    description: "Daftar barang, harga & stok",
    keywords: ["produk", "harga", "stok", "barcode"],
    permission: "product:view",
    scope: "store",
  },
  {
    title: "Stok Opname",
    href: "/stock-takes",
    icon: ClipboardListIcon,
    description: "Hitung ulang stok fisik",
    keywords: ["opname", "hitung stok", "selisih"],
    permission: "stock-take:manage",
    scope: "store",
  },
  {
    // Superadmin: daftar semua toko; Pemilik: data tokonya sendiri.
    title: "Toko",
    href: "/stores",
    icon: StoreIcon,
    description: "Data toko",
    keywords: ["klien", "cabang"],
    permission: "store:edit-own",
    scope: "platform",
  },
  {
    // Superadmin: pengguna semua toko (atau toko aktif); Pemilik: kasirnya.
    title: "Pengguna",
    href: "/users",
    icon: UsersIcon,
    description: "Akun pemilik & kasir",
    keywords: ["user", "akun", "password"],
    permission: "user:manage-cashier",
    scope: "platform",
  },
  {
    // Superadmin saja: tagihan langganan semua toko & pengaturan platform.
    title: "Tagihan",
    href: "/billing",
    icon: ReceiptIcon,
    description: "Verifikasi pembayaran langganan",
    keywords: ["billing", "bayar", "invoice"],
    permission: "subscription:manage",
    scope: "platform",
  },
  {
    title: "Pengaturan",
    href: "/settings",
    icon: SettingsIcon,
    description: "Harga paket, rekening, QRIS",
    keywords: ["platform", "rekening", "qris", "harga"],
    permission: "settings:manage",
    scope: "platform",
  },
  {
    // Selalu paling akhir (BUSINESS-FLOW §14): status langganan toko & pilihan paket.
    title: "Langganan",
    href: "/subscription",
    icon: CreditCardIcon,
    description: "Masa aktif & paket",
    keywords: ["bayar", "paket", "perpanjang"],
    permission: "subscription:view",
    scope: "store",
  },
];

// Menu operasional toko, urut sesuai kotak menu. Dipakai kartu toko di
// beranda Superadmin sebagai tombol "masuk ke toko langsung ke menu ini".
export const STORE_NAV_ITEMS: MenuItem[] = MENU_ITEMS.filter((item) => item.scope === "store");

// Halaman platform Superadmin, berpindah lewat tab di
// app/(app)/(platform)/layout.tsx. Bagi Superadmin, di halaman ini
// breadcrumb tidak menampilkan "Menu" dan tombol kembali ke menu disembunyikan.
// Pemilik juga membuka /stores/[id] (data tokonya), sebagai menu biasa.
export const PLATFORM_PAGES: { title: string; href: string }[] = [
  { title: "Toko", href: "/stores" },
  { title: "Tagihan", href: "/billing" },
  { title: "Pengaturan platform", href: "/settings" },
];

export function isPlatformPath(pathname: string) {
  return PLATFORM_PAGES.some((page) => matchesPath(pathname, page.href));
}

// Menu yang TIDAK tampil di kotak menu Superadmin: Beranda (Superadmin tidak
// punya beranda), halaman platform (sudah ada di tab), dan Langganan (dikelola
// dari detail toko & Tagihan).
export const SUPERADMIN_HIDDEN_MENUS = ["/beranda", "/subscription", ...PLATFORM_PAGES.map((page) => page.href)];

// Halaman cocok dengan menu bila URL-nya sama atau berada di bawahnya
// (misal /products/123 tetap termasuk "Barang").
export function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
