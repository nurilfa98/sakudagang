// Halaman /subscription: langganan SATU toko (Pemilik; Superadmin lewat toko
// aktif). BUSINESS-FLOW §14.
// - Kartu status: masa gratis / aktif / tenggang / habis, sampai tanggal.
// - Tagihan terbuka (menunggu konfirmasi / kurang bayar): nominal, riwayat
//   pembayaran, form bukti kekurangan, hubungi admin.
// - Selain itu: pilihan paket → panel pembayaran → "Saya sudah bayar"
//   (memilih paket tidak menyimpan apa pun). Penolakan terakhir tampil sebagai
//   pemberitahuan di atas pilihan paket.
// - Riwayat tagihan (data table, filter ?status=&year=).
//
// allowLocked: ini satu-satunya halaman yang boleh dibuka Pemilik saat toko
// terkunci (§14.3).

import { LockIcon, XCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { MENU_ITEMS } from "@/components/layout/nav-config";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceCard } from "@/features/subscriptions/components/invoice-card";
import { PlanCards } from "@/features/subscriptions/components/plan-cards";
import { StoreAccessBadge } from "@/features/subscriptions/components/subscription-badges";
import { SubscriptionsTable } from "@/features/subscriptions/components/subscriptions-table";
import { STORE_ACCESS_LABELS } from "@/features/subscriptions/constants";
import {
  getStoreSubscriptionState,
  listPayments,
  listPlansForStore,
  listSubscriptions,
  listSubscriptionYears,
} from "@/features/subscriptions/queries";
import { parseSubscriptionFilters } from "@/features/subscriptions/schemas";
import { requireStore } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/dates";
import { firstParam } from "@/lib/filters";
import { listBankAccounts } from "@/features/settings/queries";
import { getPlatformSettings } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Langganan",
};

export default function SubscriptionPage({ searchParams }: PageProps<"/subscription">) {
  return (
    <>
      <PageHeader title="Langganan" description="Status langganan toko, pilihan paket, dan riwayat tagihan." />
      <Suspense fallback={<SubscriptionSkeleton />}>
        <SubscriptionContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SubscriptionContent({ searchParams }: Pick<PageProps<"/subscription">, "searchParams">) {
  const actor = await requireStore("subscription:view", { allowLocked: true });
  const params = await searchParams;
  const filters = parseSubscriptionFilters(params, { allowStore: false });
  // ?from=/products: user mengklik menu lain saat toko terkunci (menu-launcher.tsx).
  const fromMenu = MENU_ITEMS.find((item) => item.href === firstParam(params.from));

  const [state, plans, settings, banks, history, years] = await Promise.all([
    getStoreSubscriptionState(actor.storeId),
    listPlansForStore(actor.storeId),
    getPlatformSettings(),
    listBankAccounts(),
    listSubscriptions({ ...filters, storeId: actor.storeId }),
    listSubscriptionYears(actor.storeId),
  ]);
  if (!state) return null;
  const { access, open, lastRejected } = state;
  const payments = open ? await listPayments(open.id) : [];
  const payment = { banks, hasQris: settings.qrisImageKey != null, adminPhone: settings.adminPhone };
  // Superadmin boleh melihat, tetapi tagihan dibuat oleh Pemilik toko.
  const canChoose = actor.role !== "SUPERADMIN" && can(actor, "subscription:view");

  return (
    <div className="flex flex-col gap-6">
      {access.locked && fromMenu && (
        <Alert variant="destructive">
          <LockIcon />
          <AlertTitle>Menu {fromMenu.title} belum bisa dibuka</AlertTitle>
          <AlertDescription>
            Masa gratis toko sudah berakhir. Pilih paket di bawah dan lakukan pembayaran; setelah admin
            mengonfirmasi lunas, semua menu terbuka kembali dan masa aktif toko dihitung dari tanggal lunas.
          </AlertDescription>
        </Alert>
      )}
      <Card className={access.locked ? "border-rose-300 dark:border-rose-700" : undefined}>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{actor.activeStore.name}</CardTitle>
            <StoreAccessBadge status={access.status} />
          </div>
          <CardDescription>{STORE_ACCESS_LABELS[access.status]}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {access.locked ? `Habis sejak ${formatDate(access.until)}` : `s.d. ${formatDate(access.until)}`}
          </span>
          <p className="text-sm text-muted-foreground">
            {access.locked
              ? "Toko tidak bisa dipakai sampai langganan diperpanjang. Pilih paket di bawah."
              : access.status === "GRACE"
                ? `Masa tenggang sampai ${formatDate(access.graceUntil)}. Setelah itu akses toko ditutup.`
                : access.daysLeft <= 7
                  ? `${Math.max(access.daysLeft, 0)} hari lagi. Perpanjang sekarang agar tidak terputus.`
                  : "Perpanjangan dihitung dari tanggal berakhir, jadi membayar lebih awal tidak merugikan."}
          </p>
        </CardContent>
      </Card>

      {open ? (
        <InvoiceCard invoice={open} payments={payments} payment={payment} storeName={actor.activeStore.name} />
      ) : (
        <section className="flex flex-col gap-3">
          {lastRejected && (
            <Alert variant="destructive">
              <XCircleIcon />
              <AlertTitle>
                Klaim pembayaran {lastRejected.rejectedAtLabel ? `pada ${lastRejected.rejectedAtLabel} ` : ""}ditolak
              </AlertTitle>
              <AlertDescription>
                Alasan admin: {lastRejected.rejectionNote}. Periksa kembali transfer Anda, lalu pilih paket dan kirim
                bukti yang benar.
              </AlertDescription>
            </Alert>
          )}
          <h2 className="text-sm font-medium text-muted-foreground">Pilih paket</h2>
          <PlanCards plans={plans} canChoose={canChoose} payment={payment} storeName={actor.activeStore.name} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Riwayat tagihan</h2>
        <SubscriptionsTable subscriptions={history} platform={false} filters={filters} years={years} />
      </section>
    </div>
  );
}

function SubscriptionSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-36" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
