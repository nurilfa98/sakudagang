// Halaman / (tepat setelah login): kotak menu SakuDagang dengan kolom
// pencarian, pola sama dengan ArchiPay. Menu yang tampil disaring sesuai role
// user (lihat nav-config.ts); dashboard ada di menu Beranda (/beranda).
// Superadmin yang belum membuka toko diarahkan ke daftar toko (/stores).
//
// Judul statis di luar <Suspense>; daftar menu butuh role user (cookie), jadi
// berada di dalamnya.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MenuLauncher, MenuLauncherSkeleton } from "@/components/layout/menu-launcher";
import { verifySession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Menu",
};

export default function MenuPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4 sm:py-10">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          <Suspense fallback="Selamat datang di SakuDagang">
            <Greeting />
          </Suspense>
        </h1>
        <p className="text-sm text-muted-foreground">Pilih menu untuk mulai bekerja.</p>
      </div>
      <Suspense fallback={<MenuLauncherSkeleton />}>
        <Menu />
      </Suspense>
    </div>
  );
}

// allowLocked: Pemilik toko yang terkunci tetap melihat menunya (dengan
// gembok), lalu diarahkan ke Langganan saat mengklik menu (menu-launcher.tsx).
async function Greeting() {
  const user = await verifySession({ allowLocked: true });
  return `Selamat datang di SakuDagang, ${user.fullName.split(" ")[0]}`;
}

async function Menu() {
  const user = await verifySession({ allowLocked: true });
  if (user.role === "SUPERADMIN" && !user.activeStore) redirect("/stores");
  return (
    <MenuLauncher
      role={user.role}
      storeLocked={user.role !== "SUPERADMIN" && user.activeStore?.access.locked === true}
    />
  );
}
