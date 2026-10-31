// Layout untuk SEMUA halaman setelah login (route group "(app)").
// Setiap page.tsx di dalam folder (app)/ otomatis memakai header ini, sehingga
// page fitur cukup berisi UI khusus halamannya saja.
//
//   ┌──────────────────────────────────────────────┐
//   │  Header (logo, breadcrumb, toko, tema, user) │
//   │  Pita "Melihat toko …" (Superadmin)          │
//   ├──────────────────────────────────────────────┤
//   │      ┌──────────────────────────────┐        │
//   │      │ spanduk langganan (bila ada) │        │
//   │      │ {children} = page.tsx        │        │
//   │      └──────────────────────────────┘        │
//   └──────────────────────────────────────────────┘
//
// Tidak ada sidebar (pola sama dengan ArchiPay): menu tampil sebagai kotak
// ikon di halaman /, logo dan tombol mengambang di kanan bawah kembali ke
// sana. Konten dibatasi container (max-w-6xl) agar berada di tengah layar lebar.
//
// Kenapa bagian user dibungkus <Suspense>?
// Dengan cacheComponents: true, komponen yang membaca cookie wajib berada di
// dalam <Suspense>. Hasilnya, kerangka (logo, header, konten) tampil instan
// dan hanya bagian user yang menyusul.
//
// Catatan keamanan: layout TIDAK dirender ulang saat pindah halaman, jadi
// pengecekan di layout tidak cukup untuk melindungi data. Setiap page/action
// yang mengambil atau mengubah data tetap wajib memanggil verifySession()
// atau requirePermission().
//
// Referensi:
// - node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md (Route groups)
// - node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md (Step 2)
// - node_modules/next/dist/docs/01-app/02-guides/authentication.md (bagian "Layouts and auth checks")

import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { MenuFab } from "@/components/layout/menu-fab";
import { PageBreadcrumb } from "@/components/layout/page-breadcrumb";
import { UserMenu, UserMenuSkeleton } from "@/features/auth/components/user-menu";
import { ActiveStoreBar } from "@/features/stores/components/active-store-bar";
import { ActiveStoreIndicator } from "@/features/stores/components/active-store-indicator";
import { SubscriptionBanner } from "@/features/subscriptions/components/subscription-banner";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        breadcrumb={
          <Suspense>
            <HeaderBreadcrumb />
          </Suspense>
        }
        storeIndicator={
          <Suspense>
            <HeaderStoreIndicator />
          </Suspense>
        }
        userMenu={
          <Suspense fallback={<UserMenuSkeleton />}>
            <HeaderUserMenu />
          </Suspense>
        }
      />
      <Suspense>
        <HeaderStoreBar />
      </Suspense>
      {/* min-w-0: tanpa ini tabel lebar memaksa seluruh halaman melebar
          (scroll horizontal di browser); scroll horizontal cukup di pembungkus
          tabel (components/ui/table.tsx). pb-24: ruang agar konten tidak
          tertutup tombol menu mengambang. */}
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-4 px-4 pt-6 pb-24">
        <Suspense>
          <HeaderSubscriptionBanner />
        </Suspense>
        {children}
      </main>
      <Suspense>
        <LayoutMenuFab />
      </Suspense>
    </div>
  );
}

// Komponen di bawah sama-sama memanggil verifySession(), tapi query ke
// database hanya terjadi sekali per request berkat 'use cache: private' di DAL.
// Kalau session tidak valid (misal user dinonaktifkan), user diarahkan ke /login.
//
// allowLocked: layout juga membungkus halaman Langganan, satu-satunya halaman
// yang boleh dibuka Pemilik saat langganan toko habis (BUSINESS-FLOW §14.3).
// Halaman lain tetap mengarahkan ke sana lewat verifySession() masing-masing.

// Breadcrumb & tombol menu butuh role: halaman platform Superadmin (Toko,
// Tagihan, Pengaturan platform) tidak berada di bawah kotak menu.
async function HeaderBreadcrumb() {
  const user = await verifySession({ allowLocked: true });
  return <PageBreadcrumb platformAdmin={can(user, "store:manage")} />;
}

async function LayoutMenuFab() {
  const user = await verifySession({ allowLocked: true });
  return <MenuFab platformAdmin={can(user, "store:manage")} />;
}

async function HeaderStoreBar() {
  const user = await verifySession({ allowLocked: true });
  return <ActiveStoreBar user={user} />;
}

async function HeaderStoreIndicator() {
  const user = await verifySession({ allowLocked: true });
  return <ActiveStoreIndicator user={user} />;
}

async function HeaderSubscriptionBanner() {
  const user = await verifySession({ allowLocked: true });
  return <SubscriptionBanner user={user} />;
}

async function HeaderUserMenu() {
  const user = await verifySession({ allowLocked: true });
  return <UserMenu user={{ id: user.id, fullName: user.fullName, email: user.email, role: user.role }} />;
}
