// Data table riwayat penjualan satu hari (Client Component, components/data-table).
//
// - Pencarian nomor/pelanggan di browser; filter Tanggal/Metode/Status lewat
//   URL dan diterapkan server (docs/ARCHITECTURE.md §3 "Daftar data").
// - Tanggal bawaan = hari ini (diisi halaman), jadi tidak dihitung sebagai
//   filter aktif sampai user memilih tanggal lain.
// - Kolom Laba hanya untuk pemegang product:view-cost (nilainya null untuk Kasir).
// - Penjualan yang dibatalkan tetap tampil, nomornya dicoret.

"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { createDataTableColumns, DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilters,
  DataTableFilterSelect,
  FILTER_ALL,
  useUrlFilters,
  type FilterOption,
} from "@/components/data-table/data-table-filters";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  SALE_STATUS_LABELS,
  SALE_STATUSES,
} from "@/features/sales/constants";
import type { SaleListItem } from "@/features/sales/queries";
import type { SaleFilters } from "@/features/sales/schemas";
import { countActiveFilters } from "@/lib/filters";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PaymentMethodBadge, SaleStatusBadge } from "./sale-badges";

const column = createDataTableColumns<SaleListItem>();

const numberColumn = column.accessor("number", {
  header: "Nomor",
  sortFn: "text",
  cell: ({ row }) => (
    <div>
      <Link
        href={`/sales/${row.original.id}`}
        className={cn(
          "block font-mono font-medium whitespace-nowrap after:absolute after:inset-0 hover:underline",
          row.original.status === "VOIDED" && "text-muted-foreground line-through",
        )}
      >
        {row.original.number}
      </Link>
      <span className="text-xs text-muted-foreground sm:hidden">
        {row.original.timeLabel}
        {row.original.customerName && ` · ${row.original.customerName}`}
      </span>
    </div>
  ),
});

const timeColumn = column.accessor("createdAtTime", {
  header: "Jam",
  sortFn: "basic",
  meta: { className: "hidden sm:table-cell whitespace-nowrap tabular-nums" },
  cell: ({ row }) => row.original.timeLabel,
});

const methodColumn = column.accessor("paymentMethod", {
  header: "Bayar",
  enableSorting: false,
  meta: { className: "whitespace-nowrap" },
  cell: ({ row }) => (
    <div className="flex flex-col items-start gap-1">
      <PaymentMethodBadge method={row.original.paymentMethod} paymentStatus={row.original.paymentStatus} />
      {row.original.customerName && (
        <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:block">
          {row.original.customerName}
        </span>
      )}
    </div>
  ),
});

// Kolom tersembunyi untuk pencarian nama pelanggan.
const customerColumn = column.accessor((row) => row.customerName ?? "", {
  id: "customerName",
  header: () => null,
  enableSorting: false,
  meta: { className: "hidden" },
  cell: () => null,
});

const itemCountColumn = column.accessor("itemCount", {
  header: "Barang",
  sortFn: "basic",
  meta: { className: "hidden md:table-cell text-right tabular-nums" },
});

const totalColumn = column.accessor("total", {
  header: "Total",
  sortFn: "basic",
  meta: { className: "text-right whitespace-nowrap tabular-nums font-medium" },
  cell: ({ row }) => (
    <span className={cn(row.original.status === "VOIDED" && "text-muted-foreground line-through")}>
      {formatRupiah(row.original.total)}
    </span>
  ),
});

const profitColumn = column.accessor((row) => row.grossProfit ?? 0, {
  id: "grossProfit",
  header: "Laba kotor",
  sortFn: "basic",
  meta: { className: "hidden md:table-cell text-right whitespace-nowrap tabular-nums" },
  cell: ({ row }) =>
    row.original.grossProfit == null ? (
      "-"
    ) : (
      <span
        className={cn(
          row.original.status === "VOIDED" && "text-muted-foreground line-through",
          row.original.grossProfit < 0 && "text-rose-700 dark:text-rose-300",
        )}
      >
        {formatRupiah(row.original.grossProfit)}
      </span>
    ),
});

const statusColumn = column.accessor("status", {
  header: "Status",
  enableSorting: false,
  meta: { className: "hidden sm:table-cell whitespace-nowrap" },
  cell: ({ getValue }) => <SaleStatusBadge status={getValue()} />,
});

const byColumn = column.accessor("createdByName", {
  header: "Kasir",
  sortFn: "text",
  meta: { className: "hidden lg:table-cell whitespace-nowrap" },
});

const openColumn = column.display({
  id: "open",
  header: () => <span className="sr-only">Detail</span>,
  meta: { className: "w-10" },
  cell: () => <ChevronRightIcon className="size-4 text-muted-foreground" />,
});

// Dibuat sekali di luar komponen (wajib stabil untuk TanStack Table v9).
const COLUMNS_WITH_COST = column.columns([
  numberColumn,
  timeColumn,
  methodColumn,
  customerColumn,
  itemCountColumn,
  totalColumn,
  profitColumn,
  statusColumn,
  byColumn,
  openColumn,
]);
const COLUMNS_NO_COST = column.columns([
  numberColumn,
  timeColumn,
  methodColumn,
  customerColumn,
  itemCountColumn,
  totalColumn,
  statusColumn,
  byColumn,
  openColumn,
]);
const SEARCHABLE = ["number", "customerName"] as const;

const METHOD_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua metode" },
  ...PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })),
];

const STATUS_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua status" },
  ...SALE_STATUSES.map((value) => ({ value, label: SALE_STATUS_LABELS[value] })),
];

export function SalesTable({
  sales,
  withCost,
  filters,
  date,
  today,
}: {
  sales: SaleListItem[];
  withCost: boolean;
  filters: SaleFilters;
  date: string; // tanggal yang ditampilkan (filter atau hari ini)
  today: string;
}) {
  const { setFilters, pending } = useUrlFilters();
  const dateId = useId();
  const activeFilterCount = countActiveFilters(filters);

  return (
    <DataTable
      columns={withCost ? COLUMNS_WITH_COST : COLUMNS_NO_COST}
      data={sales}
      searchableColumns={SEARCHABLE}
      searchPlaceholder="Cari nomor atau pelanggan"
      emptyMessage={date === today ? "Belum ada penjualan hari ini." : "Tidak ada penjualan pada tanggal ini."}
      activeFilterCount={activeFilterCount}
      pending={pending}
      filters={
        <DataTableFilters
          canReset={activeFilterCount > 0}
          pending={pending}
          onReset={() => setFilters({ date: undefined, method: undefined, status: undefined })}
        >
          <Field>
            <FieldLabel htmlFor={dateId}>Tanggal</FieldLabel>
            <Input
              id={dateId}
              type="date"
              value={date}
              max={today}
              // Hari ini = bawaan, tidak ditulis ke URL.
              onChange={(event) => {
                const value = event.target.value;
                setFilters({ date: value && value !== today ? value : undefined });
              }}
            />
          </Field>
          <DataTableFilterSelect
            label="Metode bayar"
            value={filters.paymentMethod ?? FILTER_ALL}
            options={METHOD_OPTIONS}
            onValueChange={(method) => setFilters({ method })}
          />
          <DataTableFilterSelect
            label="Status"
            value={filters.status ?? FILTER_ALL}
            options={STATUS_OPTIONS}
            onValueChange={(status) => setFilters({ status })}
          />
        </DataTableFilters>
      }
    />
  );
}
