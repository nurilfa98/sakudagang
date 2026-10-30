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
// - Pemilik    : dashboard pemisahan dana (§10.4) bulan berjalan, dari
//   features/reports/queries.ts.
// - Kasir      : tombol ke layar kasir, transaksinya hari ini, bon yang perlu ditagih.

import {
  BanknoteIcon,
  ClockAlertIcon,
  HandCoinsIcon,
  PiggyBankIcon,
  PlusIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ColumnChart } from "@/components/charts/column-chart";
import { PageHeader } from "@/components/layout/page-header";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreCards } from "@/features/stores/components/store-cards";
import { listStores, summarizeStores, type StoreSummary } from "@/features/stores/queries";
import { OVERDUE_DAYS } from "@/features/credits/constants";
import { listCustomerCreditSummaries } from "@/features/credits/queries";
import { monthlyBreakdown } from "@/features/reports/period";
import { getOmset, getOutstandingCredit, getPeriodTotals, getRestockList } from "@/features/reports/queries";
import { dayRange, monthRange, summarizePeriod } from "@/features/reports/service";
import { summarizeMySales } from "@/features/sales/queries";
import { countPendingSubscriptions } from "@/features/subscriptions/queries";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { zonedDateString } from "@/lib/dates";
import { formatRupiah, MONTH_NAMES } from "@/lib/format";

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

      {can(user, "report:view") ? (
        user.activeStore && <OwnerDashboard storeId={user.activeStore.id} />
      ) : (
        user.activeStore && <CashierHome storeId={user.activeStore.id} userId={user.id} />
      )}
    </div>
  );
}

// Kotak ringkasan platform untuk Superadmin. Bentuknya sama dengan kotak dana
// Pemilik, tetapi ikon & datanya tentang toko (klien) dan langganan (§14.4).
function PlatformSummary({ summary, pendingInvoices }: { summary: StoreSummary; pendingInvoices: number }) {
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
        value={pendingInvoices}
        description="Klaim bayar yang perlu dicocokkan dengan mutasi rekening lalu ditandai lunas."
        badge={
          pendingInvoices > 0 ? (
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

// Dashboard pemisahan dana (§10.4), periode bulan berjalan. Tiga kotak besar
// dengan warna menurut arti uang (modal = brand, laba = hijau, piutang =
// amber), lalu omset hari ini, grafik per hari, perlu restock, bon lama.
async function OwnerDashboard({ storeId }: { storeId: string }) {
  const today = zonedDateString(new Date());
  const [year, month] = today.split("-").map(Number);
  const [totals, outstanding, todayOmset, breakdown, restock, overdue] = await Promise.all([
    getPeriodTotals(storeId, monthRange(year, month)),
    getOutstandingCredit(storeId),
    getOmset(storeId, dayRange(today)),
    monthlyBreakdown(storeId, year, month),
    getRestockList(storeId, 8),
    listCustomerCreditSummaries(storeId, { credit: "OVERDUE", today, overdueDays: OVERDUE_DAYS, limit: 5 }),
  ]);
  const summary = summarizePeriod(totals);
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FundCard
          icon={<BanknoteIcon className="size-4" />}
          iconClassName="bg-brand text-brand-foreground"
          title="Uang modal (harus diputar)"
          amount={summary.hpp}
          description={`HPP barang terjual ${periodLabel}. Sisihkan untuk belanja stok lagi.`}
        />
        <FundCard
          icon={<PiggyBankIcon className="size-4" />}
          iconClassName="bg-emerald-600 text-white dark:bg-emerald-500"
          title="Uang laba (boleh diambil)"
          amount={summary.netProfit}
          description={`Laba bersih ${periodLabel} setelah pengeluaran dan penyusutan.`}
          badge={
            summary.netProfit < 0 ? <ToneBadge tone="danger">Rugi</ToneBadge> : <ToneBadge tone="success">Laba</ToneBadge>
          }
        />
        <FundCard
          icon={<HandCoinsIcon className="size-4" />}
          iconClassName="bg-amber-500 text-white"
          title="Piutang (uang di luar)"
          amount={outstanding}
          description="Bon pelanggan yang belum dibayar, semua periode."
          badge={
            <Button variant="link" size="sm" className="h-auto p-0" nativeButton={false} render={<Link href="/credits" />}>
              Tagih
            </Button>
          }
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Angka di atas dihitung dari transaksi, bukan uang yang terbukti ada di laci. Aplikasi tidak melacak saldo kas
        laci; pencocokan kas fisik tetap tanggung jawab pemilik.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Omset & laba bersih per hari</CardTitle>
                <CardDescription>{periodLabel}</CardDescription>
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                nativeButton={false}
                render={<Link href="/reports/monthly" />}
              >
                Laporan bulanan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ColumnChart
              ariaLabel={`Grafik omset dan laba bersih per hari, ${periodLabel}`}
              series={[{ name: "Omset" }, { name: "Laba bersih" }]}
              data={breakdown.map((row) => ({ label: row.label, tick: row.tick, values: [row.omset, row.netProfit] }))}
            />
          </CardContent>
        </Card>
        <StatCard
          icon={<ReceiptIcon className="size-4" />}
          iconClassName="bg-sky-600 text-white dark:bg-sky-500"
          title="Omset hari ini"
          value={formatRupiah(todayOmset.omset)}
          description={`${todayOmset.count.toLocaleString("id-ID")} transaksi. Omset ${periodLabel}: ${formatRupiah(summary.omset)}.`}
          badge={
            <Button variant="link" size="sm" className="h-auto p-0" nativeButton={false} render={<Link href="/reports/daily" />}>
              Laporan harian
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perlu restock</CardTitle>
            <CardDescription>Stok minus atau di bawah stok minimum.</CardDescription>
          </CardHeader>
          <CardContent>
            {restock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Semua stok aman.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {restock.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/products/${product.id}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                    >
                      <span className="truncate font-medium">{product.name}</span>
                      <span
                        className={
                          product.stock < 0
                            ? "font-medium whitespace-nowrap text-rose-700 tabular-nums dark:text-rose-300"
                            : "font-medium whitespace-nowrap text-amber-700 tabular-nums dark:text-amber-300"
                        }
                      >
                        {product.stock.toLocaleString("id-ID")} {product.unit}
                        {product.minStock != null && (
                          <span className="font-normal text-muted-foreground"> / min {product.minStock}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Bon lebih dari {OVERDUE_DAYS} hari</CardTitle>
            <CardDescription>Pelanggan dengan bon lama yang belum lunas.</CardDescription>
          </CardHeader>
          <CardContent>
            {overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada bon lama.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {overdue.map((customer) => (
                  <li key={customer.id}>
                    <Link
                      href={`/credits/${customer.id}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                    >
                      <span className="truncate font-medium">
                        {customer.name}
                        <span className="font-normal text-muted-foreground"> · sejak {customer.oldestOpenLabel}</span>
                      </span>
                      <span className="font-medium whitespace-nowrap text-amber-700 tabular-nums dark:text-amber-300">
                        {formatRupiah(customer.outstanding)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Beranda Kasir (§10.5): tombol besar ke layar kasir, ringkasan transaksinya
// sendiri hari ini (tanpa laba), dan bon terbesar yang perlu ditagih.
async function CashierHome({ storeId, userId }: { storeId: string; userId: string }) {
  const today = zonedDateString(new Date());
  const [mine, debtors] = await Promise.all([
    summarizeMySales(storeId, userId, today),
    listCustomerCreditSummaries(storeId, { credit: "OUTSTANDING", today, overdueDays: OVERDUE_DAYS, limit: 5 }),
  ]);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Button size="lg" className="h-auto min-h-24 text-lg" nativeButton={false} render={<Link href="/cashier" />}>
        <ShoppingCartIcon className="size-6" />
        Buka kasir
      </Button>
      <StatCard
        icon={<ReceiptIcon className="size-4" />}
        iconClassName="bg-brand text-brand-foreground"
        title="Transaksi saya hari ini"
        value={formatRupiah(mine.total)}
        description={`${mine.count.toLocaleString("id-ID")} transaksi, tidak termasuk yang dibatalkan.`}
        badge={
          <Button variant="link" size="sm" className="h-auto p-0" nativeButton={false} render={<Link href="/sales" />}>
            Lihat riwayat
          </Button>
        }
      />
      <Card className="sm:col-span-2">
        <CardHeader>
          <CardTitle>Bon yang perlu ditagih</CardTitle>
          <CardDescription>Sisa bon terbesar. Pelunasan dicatat di menu Bon.</CardDescription>
        </CardHeader>
        <CardContent>
          {debtors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada bon yang belum lunas.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {debtors.map((customer) => (
                <li key={customer.id}>
                  <Link
                    href={`/credits/${customer.id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                  >
                    <span className="truncate font-medium">{customer.name}</span>
                    <span className="font-medium whitespace-nowrap text-amber-700 tabular-nums dark:text-amber-300">
                      {formatRupiah(customer.outstanding)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
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
