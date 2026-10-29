// Data table riwayat tagihan (Client Component, memakai components/data-table).
// Dipakai halaman Langganan (satu toko) dan halaman Tagihan (Superadmin,
// semua toko + kolom Toko + aksi tandai lunas/batalkan).
//
// Pencarian nama toko/catatan di browser; filter Status/Tahun/Toko lewat URL
// dan diterapkan server (docs/ARCHITECTURE.md §3 "Daftar data").

"use client";

import { createDataTableColumns, DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilters,
  DataTableFilterSelect,
  FILTER_ALL,
  useUrlFilters,
  type FilterOption,
} from "@/components/data-table/data-table-filters";
import {
  PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUSES,
} from "@/features/subscriptions/constants";
import type { SubscriptionItem } from "@/features/subscriptions/queries";
import type { SubscriptionFilters } from "@/features/subscriptions/schemas";
import { countActiveFilters } from "@/lib/filters";
import { formatRupiah } from "@/lib/format";
import { BillingRowActions } from "./billing-row-actions";
import { SubscriptionStatusBadge } from "./subscription-badges";

const column = createDataTableColumns<SubscriptionItem>();

const dateColumn = column.accessor("createdAtTime", {
  header: "Dibuat",
  sortFn: "basic",
  meta: { className: "whitespace-nowrap" },
  cell: ({ row }) => (
    <div>
      <span>{row.original.createdAtLabel}</span>
      <p className="text-xs text-muted-foreground">oleh {row.original.createdByName}</p>
    </div>
  ),
});

const storeColumn = column.accessor("storeName", {
  header: "Toko",
  sortFn: "text",
  meta: { className: "whitespace-nowrap" },
});

const planColumn = column.accessor("months", {
  header: "Paket",
  sortFn: "basic",
  meta: { className: "whitespace-nowrap" },
  cell: ({ getValue }) => PLAN_LABELS[getValue()],
});

const amountColumn = column.accessor("price", {
  header: "Nominal",
  sortFn: "basic",
  meta: { className: "text-right whitespace-nowrap tabular-nums font-medium" },
  cell: ({ getValue }) => (getValue() === 0 ? "Gratis" : formatRupiah(getValue())),
});

const periodColumn = column.accessor((row) => row.periodLabel ?? "", {
  id: "period",
  header: "Periode",
  enableSorting: false,
  meta: { className: "hidden md:table-cell whitespace-nowrap" },
  cell: ({ row }) => row.original.periodLabel ?? <span className="text-muted-foreground">-</span>,
});

const noteColumn = column.accessor((row) => row.note ?? "", {
  id: "note",
  header: "Catatan",
  enableSorting: false,
  meta: { className: "hidden lg:table-cell" },
  cell: ({ getValue }) => <span className="block max-w-48 truncate">{getValue() || "-"}</span>,
});

const statusColumn = column.accessor("status", {
  header: "Status",
  sortFn: "text",
  meta: { className: "whitespace-nowrap" },
  cell: ({ getValue }) => <SubscriptionStatusBadge status={getValue()} />,
});

const actionsColumn = column.display({
  id: "actions",
  header: () => <span className="sr-only">Aksi</span>,
  meta: { className: "w-10 text-right" },
  cell: ({ row }) => (row.original.status === "PENDING" ? <BillingRowActions subscription={row.original} /> : null),
});

// Dibuat sekali di luar komponen (wajib stabil untuk TanStack Table v9).
const COLUMNS_STORE = column.columns([dateColumn, planColumn, amountColumn, periodColumn, noteColumn, statusColumn]);
const COLUMNS_PLATFORM = column.columns([
  dateColumn,
  storeColumn,
  planColumn,
  amountColumn,
  periodColumn,
  noteColumn,
  statusColumn,
  actionsColumn,
]);
const SEARCHABLE = ["storeName", "note"] as const;

const STATUS_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua status" },
  ...SUBSCRIPTION_STATUSES.map((value) => ({ value, label: SUBSCRIPTION_STATUS_LABELS[value] })),
];

export function SubscriptionsTable({
  subscriptions,
  platform,
  filters,
  years,
  storeOptions = [],
}: {
  subscriptions: SubscriptionItem[];
  platform: boolean; // true = halaman Tagihan Superadmin (kolom Toko + aksi)
  filters: SubscriptionFilters;
  years: number[];
  storeOptions?: FilterOption[];
}) {
  const { setFilters, pending } = useUrlFilters();
  const activeFilterCount = countActiveFilters(filters);

  const yearOptions: FilterOption[] = [
    { value: FILTER_ALL, label: "Semua tahun" },
    ...years.map((year) => ({ value: String(year), label: String(year) })),
  ];

  return (
    <DataTable
      columns={platform ? COLUMNS_PLATFORM : COLUMNS_STORE}
      data={subscriptions}
      searchableColumns={SEARCHABLE}
      searchPlaceholder={platform ? "Cari nama toko atau catatan" : "Cari catatan"}
      emptyMessage={activeFilterCount > 0 ? "Tidak ada tagihan pada filter ini." : "Belum ada tagihan."}
      activeFilterCount={activeFilterCount}
      pending={pending}
      filters={
        <DataTableFilters
          canReset={activeFilterCount > 0}
          pending={pending}
          onReset={() => setFilters({ status: undefined, year: undefined, storeId: undefined })}
        >
          {platform && (
            <DataTableFilterSelect
              label="Toko"
              value={filters.storeId ?? FILTER_ALL}
              options={[{ value: FILTER_ALL, label: "Semua toko" }, ...storeOptions]}
              onValueChange={(storeId) => setFilters({ storeId })}
            />
          )}
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
            onValueChange={(year) => setFilters({ year })}
          />
        </DataTableFilters>
      }
    />
  );
}
