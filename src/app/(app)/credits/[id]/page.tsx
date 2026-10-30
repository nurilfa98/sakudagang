// Halaman /credits/[id]: satu pelanggan — sisa piutang, daftar bon dengan
// tombol Bayar, riwayat pelunasan, tagih via WhatsApp, dan (Pemilik) ubah
// data / tandai tidak boleh bon.

import { ArrowLeftIcon, MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditPaymentsTable } from "@/features/credits/components/credit-payments-table";
import { CreditSalesTable } from "@/features/credits/components/credit-sales-table";
import { CustomerForm } from "@/features/credits/components/customer-form";
import { getCustomer, listCreditPayments, listCustomerCreditSales } from "@/features/credits/queries";
import { requireStore } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { zonedDateString } from "@/lib/dates";
import { formatRupiah } from "@/lib/format";
import { formatPhone, whatsAppLink } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Detail Bon Pelanggan",
};

export default function CustomerCreditPage({ params }: PageProps<"/credits/[id]">) {
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/credits" />}>
          <ArrowLeftIcon />
          Daftar bon
        </Button>
      </div>
      <Suspense fallback={<CustomerCreditSkeleton />}>
        {params.then(({ id }) => (
          <CustomerCreditContent id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function CustomerCreditContent({ id }: { id: string }) {
  const actor = await requireStore("credit:settle");
  const customer = await getCustomer(actor.storeId, id);
  // Pelanggan toko lain = "tidak ditemukan".
  if (!customer) notFound();

  const today = zonedDateString(new Date());
  const [creditSales, payments] = await Promise.all([
    listCustomerCreditSales(actor.storeId, customer.id),
    listCreditPayments(actor.storeId, { customerId: customer.id }),
  ]);
  const open = creditSales.filter((sale) => sale.paymentStatus === "UNPAID");
  const outstanding = open.reduce((sum, sale) => sum + sale.remaining, 0);

  const reminder =
    customer.phone && outstanding > 0
      ? whatsAppLink(
          customer.phone,
          `Halo ${customer.name}, ini dari ${actor.activeStore.name}. Bon belanja yang belum dibayar ` +
            `sebesar ${formatRupiah(outstanding)} (${open.length} nota). Terima kasih.`,
        )
      : null;

  return (
    <>
      <PageHeader
        title={customer.name}
        description={[customer.phone ? formatPhone(customer.phone) : null, customer.note].filter(Boolean).join(" · ") || undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!customer.allowCredit && <ToneBadge tone="danger">Tidak boleh bon</ToneBadge>}
            {reminder && (
              <Button variant="outline" nativeButton={false} render={<a href={reminder} target="_blank" rel="noreferrer" />}>
                <MessageCircleIcon />
                Tagih via WhatsApp
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Sisa piutang</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span
              className={
                outstanding > 0
                  ? "font-mono text-2xl font-semibold text-amber-700 tabular-nums dark:text-amber-300"
                  : "font-mono text-2xl font-semibold tabular-nums"
              }
            >
              {formatRupiah(outstanding)}
            </span>
            <CardDescription>
              {open.length > 0 ? `${open.length} bon belum lunas.` : "Semua bon sudah lunas."}
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total pernah bon</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {formatRupiah(creditSales.reduce((sum, sale) => sum + sale.total, 0))}
            </span>
            <CardDescription>{creditSales.length} nota bon (tidak termasuk yang dibatalkan).</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bon</CardTitle>
          <CardDescription>Belum lunas di atas, tertua dulu. Pelunasan dicatat per nota, boleh sebagian.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreditSalesTable sales={creditSales} today={today} canPay={can(actor, "credit:settle")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat pelunasan</CardTitle>
          <CardDescription>Dihitung sebagai uang masuk pada tanggal diterima.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreditPaymentsTable
            payments={payments}
            showSale
            actor={{ id: actor.id, canVoidAll: can(actor, "sale:void-all"), canSettle: can(actor, "credit:settle"), today }}
          />
        </CardContent>
      </Card>

      {can(actor, "customer:edit") && (
        <Card>
          <CardHeader>
            <CardTitle>Data pelanggan</CardTitle>
            <CardDescription>Nama, WhatsApp, catatan, dan izin bon.</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerForm customer={customer} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function CustomerCreditSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64 w-full" />
    </>
  );
}
