// Data table daftar pembelian (Client Component, memakai components/data-table).
//
// - Pencarian nomor/catatan di browser; filter Status/Tahun/Bulan lewat URL
//   dan diterapkan server (docs/ARCHITECTURE.md §3 "Daftar data").
// - Pembelian yang dibatalkan tetap tampil, nomornya dicoret.
// - Seluruh baris bisa diklik lewat link di kolom Nomor.

"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { createDataTableColumns, DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilters,
  DataTableFilterSelect,
  FILTER_ALL,
  useUrlFilters,
  type FilterOption,
} from "@/components/data-table/data-table-filters";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUSES } from "@/features/purchases/constants";
import type { PurchaseListItem } from "@/features/purchases/queries";
import type { PurchaseFilters } from "@/features/purchases/schemas";
import { countActiveFilters } from "@/lib/filters";
import { formatRupiah, MONTH_NAMES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PurchaseStatusBadge } from "./purchase-status-badge";

const column = createDataTableColumns<PurchaseListItem>();

const numberColumn = column.accessor("number", {
  header: "Nomor",
  sortFn: "text",
  cell: ({ row }) => {
    const voided = row.original.status === "VOIDED";
    return (
      <div className="max-w-56 sm:max-w-none">
        <Link
          href={`/purchases/${row.original.id}`}
          className={cn(
            "block font-mono font-medium whitespace-nowrap after:absolute after:inset-0 hover:underline",
            voided && "text-muted-foreground line-through",
          )}
        >
          {row.original.number}
        </Link>
        <span className="text-xs text-muted-foreground sm:hidden">{row.original.dateLabel}</span>
        {row.original.note && <p className="max-w-64 truncate text-xs text-muted-foreground">{row.original.note}</p>}
      </div>
    );
  },
});

// Kolom tersembunyi untuk pencarian catatan; tampilannya ikut di kolom Nomor.
const noteColumn = column.accessor((row) => row.note ?? "", {
  id: "note",
  header: () => null,
  enableSorting: false,
  meta: { className: "hidden" },
  cell: () => null,
});

const dateColumn = column.accessor("date", {
  header: "Tanggal",
  sortFn: "text",
  meta: { className: "hidden sm:table-cell whitespace-nowrap" },
  cell: ({ row }) => row.original.dateLabel,
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

const statusColumn = column.accessor("status", {
  header: "Status",
  enableSorting: false,
  meta: { className: "hidden sm:table-cell whitespace-nowrap" },
  cell: ({ getValue }) => <PurchaseStatusBadge status={getValue()} />,
});

const byColumn = column.accessor("createdByName", {
  header: "Oleh",
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
const COLUMNS = column.columns([
  numberColumn,
  noteColumn,
  dateColumn,
  itemCountColumn,
  totalColumn,
  statusColumn,
  byColumn,
  openColumn,
]);
const SEARCHABLE = ["number", "note"] as const;

const STATUS_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua status" },
  ...PURCHASE_STATUSES.map((value) => ({ value, label: PURCHASE_STATUS_LABELS[value] })),
];

const MONTH_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua bulan" },
  ...MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label })),
];

export function PurchasesTable({
  purchases,
  filters,
  years,
}: {
  purchases: PurchaseListItem[];
  filters: PurchaseFilters;
  years: number[]; // pilihan filter Tahun (tahun yang punya pembelian)
}) {
  const { setFilters, pending } = useUrlFilters();
  const activeFilterCount = countActiveFilters(filters);

  const yearOptions: FilterOption[] = [
    { value: FILTER_ALL, label: "Semua tahun" },
    ...years.map((year) => ({ value: String(year), label: String(year) })),
  ];

  return (
    <DataTable
      columns={COLUMNS}
      data={purchases}
      searchableColumns={SEARCHABLE}
      searchPlaceholder="Cari nomor atau catatan"
      emptyMessage={
        activeFilterCount > 0 ? "Tidak ada pembelian pada filter ini." : "Belum ada pembelian. Catat belanja stok pertama Anda."
      }
      activeFilterCount={activeFilterCount}
      pending={pending}
      filters={
        <DataTableFilters
          canReset={activeFilterCount > 0}
          pending={pending}
          onReset={() => setFilters({ status: undefined, year: undefined, month: undefined })}
        >
          <DataTableFilterSelect
            label="Status"
            value={filters.status ?? FILTER_ALL}
            options={STATUS_OPTIONS}
            onValueChange={(status) => setFilters({ status })}
          />
          <DataTableFilterSelect
            label="Tahun"
            value={filters.year ? String(filters.year) : FILTER_ALL}
            options={yearOptions}
            // Ganti/hapus tahun → bulan ikut dihapus.
            onValueChange={(year) => setFilters({ year, month: undefined })}
          />
          <DataTableFilterSelect
            label="Bulan"
            value={filters.month ? String(filters.month) : FILTER_ALL}
            options={MONTH_OPTIONS}
            disabled={!filters.year}
            description={filters.year ? undefined : "Pilih tahun terlebih dahulu"}
            onValueChange={(month) => setFilters({ month })}
          />
        </DataTableFilters>
      }
    />
  );
}
