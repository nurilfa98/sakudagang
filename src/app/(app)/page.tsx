// Halaman beranda (/). Sidebar & navbar sudah disediakan oleh (app)/layout.tsx,
// jadi page cukup berisi konten halaman ini.
//
// Polanya sama dengan halaman lain: judul statis di luar <Suspense>, bagian
// yang membaca user & database di dalamnya.
//
// Untuk sekarang isinya PRATINJAU dashboard pemisahan dana
// (docs/BUSINESS-FLOW.md §10.4) dengan angka nol, agar tata letak dan warna
// bisa dilihat sebelum fitur penjualan ada. Angka sungguhan menyusul dari
// features/reports/queries.ts.

import { BanknoteIcon, HandCoinsIcon, PiggyBankIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ToneBadge } from "@/components/tone-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatRupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Beranda",
};

export default function HomePage() {
  return (
    <>
      <PageHeader title="Beranda" description="Ringkasan toko bulan ini." />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </>
  );
}

async function HomeContent() {
  const user = await verifySession();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Masuk sebagai <span className="font-medium text-foreground">{user.fullName}</span> (
        {user.roles.map((role) => ROLE_LABELS[role]).join(", ")})
      </p>

      {can(user, "report:view") ? <OwnerDashboard /> : <CashierHome />}
    </div>
  );
}

// Tiga kotak pemisahan dana. Warna mengikuti arti uang (components/tone-badge.tsx):
// modal = netral/brand, laba = hijau, piutang = amber.
function OwnerDashboard() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <FundCard
        icon={<BanknoteIcon className="size-4" />}
        iconClassName="bg-brand text-brand-foreground"
        title="Uang modal (harus diputar)"
        amount={0}
        description="HPP barang terjual bulan ini. Sisihkan untuk belanja stok lagi."
      />
      <FundCard
        icon={<PiggyBankIcon className="size-4" />}
        iconClassName="bg-emerald-600 text-white dark:bg-emerald-500"
        title="Uang laba (boleh diambil)"
        amount={0}
        description="Laba bersih bulan ini setelah pengeluaran dan penyusutan."
        badge={<ToneBadge tone="success">Laba</ToneBadge>}
      />
      <FundCard
        icon={<HandCoinsIcon className="size-4" />}
        iconClassName="bg-amber-500 text-white"
        title="Piutang (uang di luar)"
        amount={0}
        description="Bon pelanggan yang belum dibayar."
        badge={<ToneBadge tone="warning">Belum lunas</ToneBadge>}
      />
    </div>
  );
}

function CashierHome() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaksi saya hari ini</CardTitle>
        <CardDescription>Layar kasir belum tersedia.</CardDescription>
      </CardHeader>
      <CardContent className="font-mono text-2xl font-semibold tabular-nums">{formatRupiah(0)}</CardContent>
    </Card>
  );
}

function FundCard({
  icon,
  iconClassName,
  title,
  amount,
  description,
  badge,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  title: string;
  amount: number;
  description: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className={`flex size-8 items-center justify-center rounded-lg ${iconClassName}`}>{icon}</div>
          {badge}
        </div>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="font-mono text-2xl font-semibold tabular-nums">{formatRupiah(amount)}</span>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}
