// Halaman /credits: pelanggan & piutang (bon) satu toko (BUSINESS-FLOW §6).
// Pemilik & Kasir (credit:settle): ringkasan piutang, daftar pelanggan urut
// sisa bon terbesar, tambah pelanggan.
//
// Filter (?credit=) dibaca dari searchParams di dalam <Suspense>.

import { ClockAlertIcon, HandCoinsIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OVERDUE_DAYS } from "@/features/credits/constants";
import { CustomersTable } from "@/features/credits/components/customers-table";
import { AddCustomerButton } from "@/features/credits/components/new-customer-dialog";
import { listCustomerCreditSummaries, type CustomerCreditSummary } from "@/features/credits/queries";
import { parseCustomerFilters } from "@/features/credits/schemas";
import { daysBetween } from "@/features/credits/service";
import { requireStore } from "@/lib/auth/dal";
import { zonedDateString } from "@/lib/dates";
import { countActiveFilters } from "@/lib/filters";
import { formatRupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Bon",
};

export default function CreditsPage({ searchParams }: PageProps<"/credits">) {
  return (
    <Suspense fallback={<CreditsSkeleton />}>
      <CreditsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CreditsContent({ searchParams }: Pick<PageProps<"/credits">, "searchParams">) {
  const actor = await requireStore("credit:settle");
  const filters = parseCustomerFilters(await searchParams);
  const today = zonedDateString(new Date());
  const options = { today, overdueDays: OVERDUE_DAYS };
  // Ringkasan selalu dari semua pelanggan, tidak ikut filter.
  const [all, filtered] = await Promise.all([
    listCustomerCreditSummaries(actor.storeId, options),
    countActiveFilters(filters) > 0 ? listCustomerCreditSummaries(actor.storeId, { ...options, ...filters }) : null,
  ]);

  return (
    <>
      <PageHeader
        title="Bon"
        description="Piutang pelanggan. Pelunasan dicatat per bon, boleh sebagian."
        action={<AddCustomerButton existingNames={all.map((customer) => customer.name.toLowerCase())} />}
      />
      <CreditSummary customers={all} today={today} />
      <CustomersTable customers={filtered ?? all} filters={filters} today={today} />
    </>
  );
}

function CreditSummary({ customers, today }: { customers: CustomerCreditSummary[]; today: string }) {
  const debtors = customers.filter((customer) => customer.outstanding > 0);
  const outstanding = debtors.reduce((sum, customer) => sum + customer.outstanding, 0);
  const overdue = debtors.filter(
    (customer) => customer.oldestOpenDate && daysBetween(customer.oldestOpenDate, today) > OVERDUE_DAYS,
  ).length;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SummaryCard
        icon={<HandCoinsIcon className="size-4" />}
        iconClassName="bg-amber-500 text-white"
        title="Piutang berjalan"
        value={formatRupiah(outstanding)}
        description="Omset yang belum jadi uang; tagih."
      />
      <SummaryCard
        icon={<UsersIcon className="size-4" />}
        iconClassName="bg-brand text-brand-foreground"
        title="Pelanggan berutang"
        value={debtors.length.toLocaleString("id-ID")}
        description={`Dari ${customers.length.toLocaleString("id-ID")} pelanggan terdaftar.`}
      />
      <SummaryCard
        icon={<ClockAlertIcon className="size-4" />}
        iconClassName="bg-rose-600 text-white dark:bg-rose-500"
        title={`Bon > ${OVERDUE_DAYS} hari`}
        value={overdue.toLocaleString("id-ID")}
        description="Pelanggan dengan bon lama yang belum lunas."
      />
    </div>
  );
}

function SummaryCard({
  icon,
  iconClassName,
  title,
  value,
  description,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className={`flex size-8 items-center justify-center rounded-lg ${iconClassName}`}>{icon}</div>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="font-mono text-2xl font-semibold tabular-nums">{value}</span>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function CreditsSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-64 w-full" />
    </>
  );
}
