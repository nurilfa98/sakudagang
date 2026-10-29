// Data table master barang (Client Component, memakai components/data-table).
//
// - Kolom Harga modal hanya untuk pemegang product:view-cost (Pemilik);
//   untuk Kasir nilainya memang tidak dikirim server (null).
// - Stok merah bila minus, amber bila ≤ stok minimum.
// - Pencarian nama/kategori di browser; filter Kategori/Status/Stok lewat URL
//   dan diterapkan server (docs/ARCHITECTURE.md §3 "Daftar data").
// - Seluruh baris bisa diklik lewat link di kolom Nama (hanya bila boleh kelola).

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
import type { ProductListItem } from "@/features/products/queries";
import type { ProductFilters } from "@/features/products/schemas";
import { isLowStock } from "@/features/products/service";
import { countActiveFilters } from "@/lib/filters";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = ProductListItem & { href: string | null };

const column = createDataTableColumns<Row>();

const nameColumn = column.accessor("name", {
  header: "Barang",
  sortFn: "text",
  cell: ({ row }) => (
    <div className="max-w-56 sm:max-w-none">
      {row.original.href ? (
        <Link href={row.original.href} className="block truncate font-medium after:absolute after:inset-0 hover:underline">
          {row.original.name}
        </Link>
      ) : (
        <span className="block truncate font-medium">{row.original.name}</span>
      )}
      <span className="text-xs text-muted-foreground md:hidden">{row.original.categoryName}</span>
    </div>
  ),
});

const categoryColumn = column.accessor("categoryName", {
  header: "Kategori",
  sortFn: "text",
  meta: { className: "hidden md:table-cell whitespace-nowrap" },
});

const costColumn = column.accessor((row) => row.costPrice ?? 0, {
  id: "costPrice",
  header: "Harga modal",
  sortFn: "basic",
  meta: { className: "hidden sm:table-cell text-right whitespace-nowrap tabular-nums" },
  cell: ({ row }) => (row.original.costPrice == null ? "-" : formatRupiah(row.original.costPrice)),
});

const sellingColumn = column.accessor("sellingPrice", {
  header: "Harga jual",
  sortFn: "basic",
  meta: { className: "text-right whitespace-nowrap tabular-nums font-medium" },
  cell: ({ getValue }) => formatRupiah(getValue()),
});

const stockColumn = column.accessor("stock", {
  header: "Stok",
  sortFn: "basic",
  meta: { className: "text-right whitespace-nowrap tabular-nums" },
  cell: ({ row }) => {
    const { stock, unit, minStock } = row.original;
    const low = isLowStock(stock, minStock);
    return (
      <span
        className={cn(
          low && stock < 0 && "font-medium text-rose-700 dark:text-rose-300",
          low && stock >= 0 && "font-medium text-amber-700 dark:text-amber-300",
        )}
      >
        {stock.toLocaleString("id-ID")} {unit}
      </span>
    );
  },
});

const statusColumn = column.accessor("isActive", {
  header: "Status",
  enableSorting: false,
  meta: { className: "hidden sm:table-cell whitespace-nowrap" },
  cell: ({ getValue }) =>
    getValue() ? (
      <ToneBadge tone="success">Aktif</ToneBadge>
    ) : (
      <ToneBadge tone="pending" className="text-slate-900 dark:text-slate-100">
        Nonaktif
      </ToneBadge>
    ),
});

const openColumn = column.display({
  id: "open",
  header: () => <span className="sr-only">Detail</span>,
  meta: { className: "w-10" },
  cell: ({ row }) => (row.original.href ? <ChevronRightIcon className="size-4 text-muted-foreground" /> : null),
});

// Dibuat sekali di luar komponen (wajib stabil untuk TanStack Table v9).
const COLUMNS_WITH_COST = column.columns([nameColumn, categoryColumn, costColumn, sellingColumn, stockColumn, statusColumn, openColumn]);
const COLUMNS_NO_COST = column.columns([nameColumn, categoryColumn, sellingColumn, stockColumn, statusColumn, openColumn]);
const SEARCHABLE = ["name", "categoryName"] as const;

const STATUS_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua status" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Nonaktif" },
];

const STOCK_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua stok" },
  { value: "LOW", label: "Perlu restock (minus / ≤ minimum)" },
];

export function ProductsTable({
  products,
  withCost,
  canManage,
  filters,
  categories,
}: {
  products: ProductListItem[];
  withCost: boolean;
  canManage: boolean;
  filters: ProductFilters;
  categories: FilterOption[]; // kategori toko ini, untuk dropdown
}) {
  const { setFilters, pending } = useUrlFilters();
  const activeFilterCount = countActiveFilters(filters);

  const rows = useMemo<Row[]>(
    () => products.map((p) => ({ ...p, href: canManage ? `/products/${p.id}` : null })),
    [products, canManage],
  );

  const categoryOptions: FilterOption[] = [{ value: FILTER_ALL, label: "Semua kategori" }, ...categories];

  return (
    <DataTable
      columns={withCost ? COLUMNS_WITH_COST : COLUMNS_NO_COST}
      data={rows}
      searchableColumns={SEARCHABLE}
      searchPlaceholder="Cari nama barang atau kategori"
      emptyMessage={
        activeFilterCount > 0 ? "Tidak ada barang pada filter ini." : "Belum ada barang. Tambahkan barang pertama Anda."
      }
      activeFilterCount={activeFilterCount}
      pending={pending}
      filters={
        <DataTableFilters
          canReset={activeFilterCount > 0}
          pending={pending}
          onReset={() => setFilters({ category: undefined, status: undefined, stock: undefined })}
        >
          <DataTableFilterSelect
            label="Kategori"
            value={filters.categoryId ?? FILTER_ALL}
            options={categoryOptions}
            onValueChange={(category) => setFilters({ category })}
          />
          <DataTableFilterSelect
            label="Status"
            value={filters.status ?? FILTER_ALL}
            options={STATUS_OPTIONS}
            onValueChange={(status) => setFilters({ status })}
          />
          <DataTableFilterSelect
            label="Stok"
            value={filters.stock ?? FILTER_ALL}
            options={STOCK_OPTIONS}
            onValueChange={(stock) => setFilters({ stock })}
          />
        </DataTableFilters>
      }
    />
  );
}
