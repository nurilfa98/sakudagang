// Data table pelanggan & piutang (Client Component, components/data-table).
//
// - Urut sisa piutang terbesar dulu (dari server).
// - Bon tertua > 30 hari disorot amber (perlu ditagih, BUSINESS-FLOW §10.4).
// - Pencarian nama/nomor di browser; filter piutang lewat URL (?credit=).

"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { createDataTableColumns, DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilters,
  DataTableFilterSelect,
  FILTER_ALL,
  useUrlFilters,
  type FilterOption,
} from "@/components/data-table/data-table-filters";
import { ToneBadge } from "@/components/tone-badge";
import { OVERDUE_DAYS } from "@/features/credits/constants";
import type { CustomerCreditSummary } from "@/features/credits/queries";
import type { CustomerFilters } from "@/features/credits/schemas";
import { daysBetween } from "@/features/credits/service";
import { countActiveFilters } from "@/lib/filters";
import { formatRupiah } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

type Row = CustomerCreditSummary & { ageDays: number | null; phoneLabel: string };

const column = createDataTableColumns<Row>();

const nameColumn = column.accessor("name", {
  header: "Pelanggan",
  sortFn: "text",
  cell: ({ row }) => (
    <div className="max-w-56 sm:max-w-none">
      <Link href={`/credits/${row.original.id}`} className="block truncate font-medium after:absolute after:inset-0 hover:underline">
        {row.original.name}
      </Link>
      <span className="text-xs text-muted-foreground tabular-nums">{row.original.phoneLabel}</span>
      {!row.original.allowCredit && (
        <ToneBadge tone="danger" className="ml-1.5">
          Tidak boleh bon
        </ToneBadge>
      )}
    </div>
  ),
});

// Kolom tersembunyi untuk pencarian nomor WhatsApp.
const phoneColumn = column.accessor("phoneLabel", {
  header: () => null,
  enableSorting: false,
  meta: { className: "hidden" },
  cell: () => null,
});

const openCountColumn = column.accessor("openCount", {
  header: "Bon aktif",
  sortFn: "basic",
  meta: { className: "hidden sm:table-cell text-right tabular-nums" },
});

const oldestColumn = column.accessor((row) => row.ageDays ?? -1, {
  id: "oldest",
  header: "Bon tertua",
  sortFn: "basic",
  meta: { className: "hidden md:table-cell whitespace-nowrap" },
  cell: ({ row }) =>
    row.original.oldestOpenLabel ? (
      <span className={cn((row.original.ageDays ?? 0) > OVERDUE_DAYS && "font-medium text-amber-700 dark:text-amber-300")}>
        {row.original.oldestOpenLabel}
        <span className="text-xs text-muted-foreground"> ({row.original.ageDays} hari)</span>
      </span>
    ) : (
      <span className="text-muted-foreground">-</span>
    ),
});

const outstandingColumn = column.accessor("outstanding", {
  header: "Sisa piutang",
  sortFn: "basic",
  meta: { className: "text-right whitespace-nowrap tabular-nums font-medium" },
  cell: ({ getValue }) =>
    getValue() > 0 ? (
      <span className="text-amber-700 dark:text-amber-300">{formatRupiah(getValue())}</span>
    ) : (
      <span className="text-muted-foreground">Lunas</span>
    ),
});

const openColumn = column.display({
  id: "open",
  header: () => <span className="sr-only">Detail</span>,
  meta: { className: "w-10" },
  cell: () => <ChevronRightIcon className="size-4 text-muted-foreground" />,
});

// Dibuat sekali di luar komponen (wajib stabil untuk TanStack Table v9).
const COLUMNS = column.columns([nameColumn, phoneColumn, openCountColumn, oldestColumn, outstandingColumn, openColumn]);
const SEARCHABLE = ["name", "phoneLabel"] as const;

const CREDIT_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua pelanggan" },
  { value: "OUTSTANDING", label: "Masih punya bon" },
  { value: "OVERDUE", label: `Bon lebih dari ${OVERDUE_DAYS} hari` },
];

export function CustomersTable({
  customers,
  filters,
  today,
}: {
  customers: CustomerCreditSummary[];
  filters: CustomerFilters;
  today: string;
}) {
  const { setFilters, pending } = useUrlFilters();
  const activeFilterCount = countActiveFilters(filters);

  const rows = useMemo<Row[]>(
    () =>
      customers.map((customer) => ({
        ...customer,
        ageDays: customer.oldestOpenDate ? daysBetween(customer.oldestOpenDate, today) : null,
        phoneLabel: customer.phone ? formatPhone(customer.phone) : "",
      })),
    [customers, today],
  );

  return (
    <DataTable
      columns={COLUMNS}
      data={rows}
      searchableColumns={SEARCHABLE}
      searchPlaceholder="Cari nama atau nomor WhatsApp"
      emptyMessage={
        activeFilterCount > 0 ? "Tidak ada pelanggan pada filter ini." : "Belum ada pelanggan. Tambahkan dari sini atau dari layar kasir."
      }
      activeFilterCount={activeFilterCount}
      pending={pending}
      filters={
        <DataTableFilters canReset={activeFilterCount > 0} pending={pending} onReset={() => setFilters({ credit: undefined })}>
          <DataTableFilterSelect
            label="Piutang"
            value={filters.credit ?? FILTER_ALL}
            options={CREDIT_OPTIONS}
            onValueChange={(credit) => setFilters({ credit })}
          />
        </DataTableFilters>
      }
    />
  );
}
