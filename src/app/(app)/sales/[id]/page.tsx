// Halaman /sales/[id]: detail satu penjualan dan tombol pembatalan.
// - Pemilik: semua penjualan, dengan HPP & laba kotor.
// - Kasir: hanya penjualannya sendiri (milik kasir lain = tidak ditemukan),
//   tanpa harga modal; tombol batal hanya di hari yang sama.
// - Bon: riwayat pelunasan + tombol Bayar; tombol batal disembunyikan bila
//   sudah ada pelunasan (server juga menolaknya).

import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditPaymentsTable } from "@/features/credits/components/credit-payments-table";
import { PayCreditButton } from "@/features/credits/components/pay-credit-button";
import { listCreditPayments } from "@/features/credits/queries";
import { remainingCredit } from "@/features/credits/service";
import { PaymentMethodBadge, SaleStatusBadge } from "@/features/sales/components/sale-badges";
import { SaleItemsTable } from "@/features/sales/components/sale-items-table";
import { VoidSaleAction } from "@/features/sales/components/void-sale-action";
import { getSale } from "@/features/sales/queries";
import { canVoidSale } from "@/features/sales/service";
import { requireStore } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { zonedDateString } from "@/lib/dates";
import { formatRupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Detail Penjualan",
};

export default function SaleDetailPage({ params }: PageProps<"/sales/[id]">) {
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/sales" />}>
          <ArrowLeftIcon />
          Riwayat penjualan
        </Button>
      </div>
      <Suspense fallback={<SaleDetailSkeleton />}>
        {params.then(({ id }) => (
          <SaleDetailContent id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function SaleDetailContent({ id }: { id: string }) {
  const actor = await requireStore("sale:create");
  const withCost = can(actor, "product:view-cost");
  const canVoidAll = can(actor, "sale:void-all");
  const sale = await getSale(actor.storeId, id, { withCost, createdById: canVoidAll ? undefined : actor.id });
  // Penjualan toko lain / kasir lain = "tidak ditemukan".
  if (!sale) notFound();

  const today = zonedDateString(new Date());
  const voided = sale.status === "VOIDED";
  // Bon: riwayat pelunasan. Bon yang sudah dicicil tidak bisa dibatalkan.
  const creditPayments =
    sale.paymentMethod === "CREDIT" ? await listCreditPayments(actor.storeId, { saleId: sale.id }) : null;
  const paidAmount = (creditPayments ?? [])
    .filter((payment) => payment.status === "COMPLETED")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const canVoid =
    !voided &&
    paidAmount === 0 &&
    can(actor, "sale:void-own") &&
    canVoidSale({ canVoidAll, actorId: actor.id, today, sale });

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{sale.number}</span>}
        description={`${sale.createdAtLabel} · kasir ${sale.createdByName}`}
        action={<SaleStatusBadge status={sale.status} />}
      />

      {voided && (
        <Alert variant="destructive">
          <AlertTitle>
            Dibatalkan{sale.voidedByName ? ` oleh ${sale.voidedByName}` : ""}, {sale.voidedAtLabel}
          </AlertTitle>
          <AlertDescription>
            Alasan: {sale.voidReason}. Stok sudah dikembalikan; transaksi ini tidak dihitung di laporan.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total" value={formatRupiah(sale.total)}>
          <PaymentMethodBadge method={sale.paymentMethod} paymentStatus={sale.paymentStatus} />
        </Stat>
        {sale.paymentMethod === "CASH" && sale.cashReceived != null && (
          <Stat label="Uang diterima" value={formatRupiah(sale.cashReceived)}>
            <span className="text-sm text-muted-foreground">
              Kembalian {formatRupiah(sale.cashReceived - sale.total)}
            </span>
          </Stat>
        )}
        {sale.paymentMethod === "CREDIT" && (
          <Stat label="Pelanggan (bon)" value={sale.customerName ?? "-"}>
            {creditPayments && (
              <span className="text-sm text-muted-foreground">
                {sale.paymentStatus === "PAID"
                  ? "Sudah lunas."
                  : `Sisa ${formatRupiah(remainingCredit(sale.total, paidAmount))}; tercatat sebagai piutang.`}
              </span>
            )}
            {sale.customerId && can(actor, "credit:settle") && (
              <Link href={`/credits/${sale.customerId}`} className="text-sm underline">
                Semua bon pelanggan ini
              </Link>
            )}
          </Stat>
        )}
        {sale.totalGrossProfit != null && (
          <Stat label="Laba kotor" value={formatRupiah(sale.totalGrossProfit)}>
            <span className="text-sm text-muted-foreground">HPP {formatRupiah(sale.totalCost ?? 0)}</span>
          </Stat>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Barang</CardTitle>
          <CardDescription>Harga tersimpan saat transaksi; perubahan harga barang setelahnya tidak berpengaruh.</CardDescription>
        </CardHeader>
        <CardContent>
          <SaleItemsTable
            items={sale.items}
            total={sale.total}
            totalGrossProfit={sale.totalGrossProfit}
            linkProducts={can(actor, "product:manage")}
          />
        </CardContent>
      </Card>

      {creditPayments && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Pelunasan bon</CardTitle>
                <CardDescription>
                  Bon yang sudah ada pelunasannya tidak bisa dibatalkan; batalkan pelunasannya dulu.
                </CardDescription>
              </div>
              {!voided && sale.paymentStatus === "UNPAID" && can(actor, "credit:settle") && (
                <PayCreditButton
                  sale={{ ...sale, remaining: remainingCredit(sale.total, paidAmount) }}
                  today={today}
                  size="default"
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <CreditPaymentsTable
              payments={creditPayments}
              showSale={false}
              actor={{ id: actor.id, canVoidAll, canSettle: can(actor, "credit:settle"), today }}
            />
          </CardContent>
        </Card>
      )}

      {canVoid && (
        <Card>
          <CardHeader>
            <CardTitle>Pembatalan</CardTitle>
            <CardDescription>
              {canVoidAll
                ? "Pemilik bisa membatalkan penjualan kapan pun."
                : "Kasir hanya bisa membatalkan transaksinya sendiri pada hari yang sama."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VoidSaleAction saleId={sale.id} number={sale.number} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-1.5">
        <span className="truncate font-mono text-2xl font-semibold tabular-nums">{value}</span>
        {children}
      </CardContent>
    </Card>
  );
}

function SaleDetailSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64 w-full" />
    </>
  );
}
