// Tombol mengambang di pojok kanan bawah: kembali ke kotak menu (/), sama
// seperti klik logo SakuDagang di header. Tidak tampil di halaman menu itu
// sendiri, di layar Kasir (agar tidak menutupi tombol bayar), dan di halaman
// platform Superadmin (dari sana Superadmin masuk lewat tombol Buka toko).
//
// Client Component karena butuh usePathname(). Di halaman dengan segmen
// dinamis, URL baru diketahui saat request, jadi layout membungkusnya dengan
// <Suspense> (sama seperti PageBreadcrumb).

"use client";

import { LayoutGridIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isPlatformPath } from "./nav-config";

const HIDDEN_ON = ["/", "/cashier"];

// `platformAdmin` = user Superadmin (dikirim dari layout).
export function MenuFab({ platformAdmin = false }: { platformAdmin?: boolean }) {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname) || (platformAdmin && isPlatformPath(pathname))) return null;

  return (
    <Button
      variant="brand"
      size="icon-lg"
      nativeButton={false}
      render={<Link href="/" />}
      aria-label="Kembali ke menu"
      title="Kembali ke menu"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 size-12 rounded-full shadow-lg sm:right-6 sm:bottom-6"
    >
      <LayoutGridIcon className="size-5" />
    </Button>
  );
}
