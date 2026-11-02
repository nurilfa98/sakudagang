// Data table pengeluaran (Client Component, components/data-table).
//
// - Pencarian keterangan/kategori di browser; filter Tahun/Bulan/Kategori
//   lewat URL dan diterapkan server (docs/ARCHITECTURE.md §3 "Daftar data").
// - Total di atas tabel = jumlah semua baris yang dimuat (sesuai filter).
// - Aksi per baris: ubah (dialog) dan hapus (konfirmasi). Pengeluaran boleh
//   dihapus karena bukan transaksi stok (BUSINESS-FLOW §7).
// - HP (< md): kartu (ExpenseCard), 10 dulu lalu +10 saat di-scroll.

"use client";

import { Trash2Icon } from "lucide-react";
import { useMemo } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { createDataTableColumns, DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilters,
  DataTableFilterSelect,
  FILTER_ALL,
  useUrlFilters,
  type FilterOption,
} from "@/components/data-table/data-table-filters";
import { deleteExpense } from "@/features/expenses/actions";
import type { ExpenseItem } from "@/features/expenses/queries";
import type { ExpenseFilters } from "@/features/expenses/schemas";
import { countActiveFilters } from "@/lib/filters";
import { formatRupiah, MONTH_NAMES } from "@/lib/format";
import { notify } from "@/lib/notify";
import { ExpenseDialog } from "./expense-dialog";

type CategoryOption = { id: string; name: string };

// Kategori & tanggal hari ini ikut di tiap baris untuk dialog ubah.
type Row = ExpenseItem & { categories: CategoryOption[]; today: string };

const column = createDataTableColumns<Row>();

const dateColumn = column.accessor("date", {
  header: "Tanggal",
  sortFn: "text",
  meta: { className: "whitespace-nowrap" },
  cell: ({ row }) => row.original.dateLabel,
});

const categoryColumn = column.accessor("categoryName", {
  header: "Kategori",
  sortFn: "text",
  cell: ({ row }) => (
    <div className="max-w-56 sm:max-w-80">
      <p className="font-medium">{row.original.categoryName}</p>
      {row.original.note && <p className="truncate text-xs text-muted-foreground">{row.original.note}</p>}
    </div>
  ),
});

// Kolom tersembunyi untuk pencarian keterangan.
const noteColumn = column.accessor((row) => row.note ?? "", {
  id: "note",
  header: () => null,
  enableSorting: false,
  meta: { className: "hidden" },
  cell: () => null,
});

const amountColumn = column.accessor("amount", {
  header: "Nominal",
  sortFn: "basic",
  meta: { className: "text-right whitespace-nowrap tabular-nums font-medium" },
  cell: ({ getValue }) => formatRupiah(getValue()),
});

const byColumn = column.accessor("createdByName", {
  header: "Dicatat",
  sortFn: "text",
  meta: { className: "hidden md:table-cell whitespace-nowrap text-muted-foreground" },
});

const actionsColumn = column.display({
  id: "actions",
  header: () => <span className="sr-only">Aksi</span>,
  meta: { className: "w-20" },
  cell: ({ row }) => <ExpenseActions row={row.original} />,
});

// Tombol ubah & hapus satu pengeluaran (dipakai kolom tabel dan kartu HP).
function ExpenseActions({ row }: { row: Row }) {
  return (
    <div className="flex justify-end gap-1">
      <ExpenseDialog categories={row.categories} today={row.today} expense={row} />
      <ConfirmButton
        label=""
        variant="ghost"
        size="icon-sm"
        icon={<Trash2Icon />}
        ariaLabel="Hapus pengeluaran"
        tooltip="Hapus pengeluaran"
        dialogTitle={`Hapus pengeluaran ${formatRupiah(row.amount)}?`}
        dialogDescription={`${row.categoryName}, ${row.dateLabel}. Data dihapus permanen dan laba bersih tanggal itu bertambah lagi.`}
        confirmLabel="Hapus"
        onConfirm={async () => {
          const result = await deleteExpense(row.id);
          if (!result.success) notify.error(result.message);
          else notify.success("Pengeluaran dihapus.");
        }}
      />
    </div>
  );
}

// Kartu satu pengeluaran untuk HP. Tidak bisa diklik seluruhnya: tombol ubah &
// hapus tetap terpisah.
function ExpenseCard({ row }: { row: Row }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{row.categoryName}</span>
          {row.note && <span className="line-clamp-2 text-sm text-muted-foreground">{row.note}</span>}
        </div>
        <span className="font-semibold whitespace-nowrap tabular-nums">{formatRupiah(row.amount)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {row.dateLabel} · {row.createdByName}
        </span>
        <div className="-my-1 -mr-1 shrink-0">
          <ExpenseActions row={row} />
        </div>
      </div>
    </div>
  );
}

// Dibuat sekali di luar komponen (wajib stabil untuk TanStack Table v9).
const COLUMNS = column.columns([dateColumn, categoryColumn, noteColumn, amountColumn, byColumn, actionsColumn]);
const SEARCHABLE = ["categoryName", "note"] as const;

const MONTH_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua bulan" },
  ...MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label })),
];

export function ExpensesTable({
  expenses,
  categories,
  filters,
  years,
  today,
}: {
  expenses: ExpenseItem[];
  categories: CategoryOption[];
  filters: ExpenseFilters;
  years: number[];
  today: string;
}) {
  const { setFilters, pending } = useUrlFilters();
  const activeFilterCount = countActiveFilters(filters);
  const rows = useMemo<Row[]>(
    () => expenses.map((expense) => ({ ...expense, categories, today })),
    [expenses, categories, today],
  );

  const yearOptions: FilterOption[] = [
    { value: FILTER_ALL, label: "Semua tahun" },
    ...years.map((year) => ({ value: String(year), label: String(year) })),
  ];
  const categoryOptions: FilterOption[] = [
    { value: FILTER_ALL, label: "Semua kategori" },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  return (
    <DataTable
      columns={COLUMNS}
      data={rows}
      searchableColumns={SEARCHABLE}
      searchPlaceholder="Cari kategori atau keterangan"
      emptyMessage={activeFilterCount > 0 ? "Tidak ada pengeluaran pada filter ini." : "Belum ada pengeluaran."}
      activeFilterCount={activeFilterCount}
      pending={pending}
      renderCard={(row) => <ExpenseCard row={row} />}
      filters={
        <DataTableFilters
          canReset={activeFilterCount > 0}
          pending={pending}
          onReset={() => setFilters({ year: undefined, month: undefined, category: undefined })}
        >
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
          <DataTableFilterSelect
            label="Kategori"
            value={filters.categoryId ?? FILTER_ALL}
            options={categoryOptions}
            onValueChange={(category) => setFilters({ category })}
          />
        </DataTableFilters>
      }
    />
  );
}
