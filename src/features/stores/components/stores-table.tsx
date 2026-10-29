// Data table daftar toko / klien (Client Component, memakai components/data-table).
//
// - Pencarian nama toko & nama pemilik di browser; filter Status/Jenis usaha
//   lewat URL dan diterapkan server (docs/ARCHITECTURE.md §3 "Daftar data").
// - Seluruh baris bisa diklik lewat link di kolom Toko.

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
import type { StoreListItem } from "@/features/stores/queries";
import type { StoreFilters } from "@/features/stores/schemas";
import { StoreAccessBadge } from "@/features/subscriptions/components/subscription-badges";
import { countActiveFilters } from "@/lib/filters";
import { StoreStatusBadge } from "./store-status-badge";

type Row = StoreListItem & { ownerLabel: string };

const column = createDataTableColumns<Row>();

const nameColumn = column.accessor("name", {
  header: "Toko",
  sortFn: "text",
  cell: ({ row }) => (
    <div className="max-w-48 sm:max-w-none">
      <Link href={`/stores/${row.original.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
        {row.original.name}
      </Link>
      <p className="truncate text-xs text-muted-foreground">{row.original.businessType ?? "-"}</p>
    </div>
  ),
});

const ownerColumn = column.accessor("ownerLabel", {
  header: "Pemilik",
  sortFn: "text",
  meta: { className: "hidden md:table-cell" },
  cell: ({ getValue }) =>
    getValue() || <span className="text-amber-700 dark:text-amber-300">Belum ada pemilik</span>,
});

const userCountColumn = column.accessor("userCount", {
  header: "Pengguna",
  sortFn: "basic",
  meta: { className: "hidden sm:table-cell text-right tabular-nums" },
});

const productCountColumn = column.accessor("productCount", {
  header: "Barang",
  sortFn: "basic",
  meta: { className: "hidden sm:table-cell text-right tabular-nums" },
});

const statusColumn = column.accessor("isActive", {
  header: "Status",
  enableSorting: false,
  cell: ({ getValue }) => <StoreStatusBadge isActive={getValue()} />,
});

// Urut berdasarkan tanggal berakhir, supaya yang segera habis mudah ditemukan.
const subscriptionColumn = column.accessor((row) => row.access.until.getTime(), {
  id: "subscription",
  header: "Langganan",
  sortFn: "basic",
  meta: { className: "hidden md:table-cell whitespace-nowrap" },
  cell: ({ row }) => <StoreAccessBadge status={row.original.access.status} />,
});

const openColumn = column.display({
  id: "open",
  header: () => <span className="sr-only">Detail</span>,
  meta: { className: "w-10" },
  cell: () => <ChevronRightIcon className="size-4 text-muted-foreground" />,
});

// Dibuat sekali di luar komponen (wajib stabil untuk TanStack Table v9).
const COLUMNS = column.columns([
  nameColumn,
  ownerColumn,
  userCountColumn,
  productCountColumn,
  subscriptionColumn,
  statusColumn,
  openColumn,
]);
const SEARCHABLE = ["name", "ownerLabel"] as const;

const STATUS_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua status" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Nonaktif" },
];

export function StoresTable({
  stores,
  filters,
  businessTypes,
}: {
  stores: StoreListItem[];
  filters: StoreFilters;
  businessTypes: string[]; // jenis usaha yang pernah diisi, untuk dropdown
}) {
  const { setFilters, pending } = useUrlFilters();
  const activeFilterCount = countActiveFilters(filters);
  const rows: Row[] = stores.map((store) => ({ ...store, ownerLabel: store.ownerNames.join(", ") }));

  const typeOptions: FilterOption[] = [
    { value: FILTER_ALL, label: "Semua jenis usaha" },
    ...businessTypes.map((type) => ({ value: type, label: type })),
  ];

  return (
    <DataTable
      columns={COLUMNS}
      data={rows}
      searchableColumns={SEARCHABLE}
      searchPlaceholder="Cari nama toko atau pemilik"
      emptyMessage={
        activeFilterCount > 0
          ? "Tidak ada toko pada filter ini."
          : "Belum ada toko. Buat toko pertama, lalu tambahkan akun pemiliknya."
      }
      activeFilterCount={activeFilterCount}
      pending={pending}
      filters={
        <DataTableFilters
          canReset={activeFilterCount > 0}
          pending={pending}
          onReset={() => setFilters({ status: undefined, type: undefined })}
        >
          <DataTableFilterSelect
            label="Status"
            value={filters.status ?? FILTER_ALL}
            options={STATUS_OPTIONS}
            onValueChange={(status) => setFilters({ status })}
          />
          <DataTableFilterSelect
            label="Jenis usaha"
            value={filters.businessType ?? FILTER_ALL}
            options={typeOptions}
            onValueChange={(type) => setFilters({ type })}
          />
        </DataTableFilters>
      }
    />
  );
}
