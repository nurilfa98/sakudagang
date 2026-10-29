// Halaman beranda (/). Sidebar & navbar sudah disediakan oleh (app)/layout.tsx,
// jadi page cukup berisi konten halaman ini.
//
// Polanya sama dengan halaman lain: judul statis di luar <Suspense>, bagian
// yang membaca user & database di dalamnya.
//
// Isi beranda mengikuti hierarki Superadmin → Toko → Pemilik → Kasir
// (docs/BUSINESS-FLOW.md §2):
// - Superadmin : beranda PLATFORM. Kotak ringkasan klien (jumlah toko aktif,
//   nonaktif, pengguna) lalu kartu per toko dengan tombol masuk ke menu toko.
// - Pemilik    : PRATINJAU dashboard pemisahan dana (§10.4) dengan angka nol,
//   agar tata letak dan warna bisa dilihat sebelum fitur penjualan ada. Angka
//   sungguhan menyusul dari features/reports/queries.ts.
// - Kasir      : ringkasan transaksinya hari ini.

import {
  BanknoteIcon,
  ClockAlertIcon,
  HandCoinsIcon,
  PiggyBankIcon,
  PlusIcon,
  ReceiptIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreCards } from "@/features/stores/components/store-cards";
import { listStores, summarizeStores, type StoreSummary } from "@/features/stores/queries";
import { countPendingSubscriptions, type PendingCounts } from "@/features/subscriptions/queries";
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
      <PageHeader title="Beranda" />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </>
  );
}

async function HomeContent() {
  const user = await verifySession();

  // Superadmin: beranda platform = ringkasan klien + kartu per toko.
  if (can(user, "store:manage")) {
    const [stores, pendingInvoices] = await Promise.all([listStores(), countPendingSubscriptions()]);
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Masuk sebagai <span className="font-medium text-foreground">{user.fullName}</span> ({ROLE_LABELS[user.role]})
            {" · "}pengelola platform
          </p>
          <Button size="sm" nativeButton={false} render={<Link href="/stores/new" />}>
            <PlusIcon />
            Tambah toko
          </Button>
        </div>
        <PlatformSummary summary={summarizeStores(stores)} pendingInvoices={pendingInvoices} />
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Toko (klien)</h2>
          <StoreCards stores={stores} activeStoreId={user.activeStore?.id ?? null} />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Masuk sebagai <span className="font-medium text-foreground">{user.fullName}</span> (
        {ROLE_LABELS[user.role]})
      </p>

      {can(user, "report:view") ? <OwnerDashboard /> : <CashierHome />}
    </div>
  );
}

// Kotak ringkasan platform untuk Superadmin. Bentuknya sama dengan kotak dana
// Pemilik, tetapi ikon & datanya tentang toko (klien) dan langganan (§14.4).
function PlatformSummary({ summary, pendingInvoices }: { summary: StoreSummary; pendingInvoices: PendingCounts }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<StoreIcon className="size-4" />}
        iconClassName="bg-brand text-brand-foreground"
        title="Toko aktif"
        value={summary.activeStores}
        description={
          summary.inactiveStores > 0
            ? `Dari ${summary.totalStores} toko terdaftar; ${summary.inactiveStores} dinonaktifkan.`
            : `Dari ${summary.totalStores} toko terdaftar.`
        }
        badge={
          summary.storesWithoutOwner > 0 ? (
            <ToneBadge tone="warning">{summary.storesWithoutOwner} belum ada pemilik</ToneBadge>
          ) : undefined
        }
      />
      <StatCard
        icon={<ClockAlertIcon className="size-4" />}
        iconClassName="bg-amber-500 text-white"
        title="Akan habis ≤ 7 hari"
        value={summary.expiringSoon}
        description="Masa gratis/langganan segera berakhir atau sedang masa tenggang."
        badge={summary.lockedStores > 0 ? <ToneBadge tone="danger">{summary.lockedStores} terkunci</ToneBadge> : undefined}
      />
      <StatCard
        icon={<ReceiptIcon className="size-4" />}
        iconClassName="bg-sky-600 text-white dark:bg-sky-500"
        title="Perlu konfirmasi"
        value={pendingInvoices.claimed}
        description={
          pendingInvoices.pending > 0
            ? `Klaim bayar yang perlu dicocokkan lalu ditandai lunas; ${pendingInvoices.pending} tagihan lain masih menunggu pembayaran.`
            : "Klaim bayar yang perlu dicocokkan dengan mutasi rekening lalu ditandai lunas."
        }
        badge={
          pendingInvoices.claimed + pendingInvoices.pending > 0 ? (
            <Button variant="link" size="sm" className="h-auto p-0" nativeButton={false} render={<Link href="/billing" />}>
              Buka Tagihan
            </Button>
          ) : undefined
        }
      />
      <StatCard
        icon={<UsersIcon className="size-4" />}
        iconClassName="bg-emerald-600 text-white dark:bg-emerald-500"
        title="Pengguna toko"
        value={summary.totalUsers}
        description="Pemilik dan kasir di seluruh toko."
      />
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

function FundCard({ amount, ...props }: Omit<StatCardProps, "value"> & { amount: number }) {
  return <StatCard {...props} value={formatRupiah(amount)} />;
}

type StatCardProps = {
  icon: React.ReactNode;
  iconClassName: string;
  title: string;
  value: number | string;
  description: string;
  badge?: React.ReactNode;
};

// Kotak angka umum: ikon berwarna, judul, angka besar, keterangan.
function StatCard({ icon, iconClassName, title, value, description, badge }: StatCardProps) {
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
        <span className="font-mono text-2xl font-semibold tabular-nums">{value}</span>
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
