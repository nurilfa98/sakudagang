// Riwayat mutasi stok satu barang (Client Component, memakai components/data-table).
//
// - Pencarian catatan/nama pencatat di browser; filter Jenis/Tahun/Bulan
//   lewat URL dan diterapkan server (docs/ARCHITECTURE.md §3 "Daftar data").
// - Tanggal sudah diformat di server (lib/dates.ts khusus server); angka
//   createdAtTime dipakai untuk mengurutkan.
// - HP (< md): kartu (MovementCard), 10 dulu lalu +10 saat di-scroll.

"use client";

import { createDataTableColumns, DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilters,
  DataTableFilterSelect,
  FILTER_ALL,
  useUrlFilters,
  type FilterOption,
} from "@/components/data-table/data-table-filters";
import { ToneBadge, type Tone } from "@/components/tone-badge";
import { STOCK_MOVEMENT_LABELS } from "@/features/products/constants";
import type { StockMovementItem } from "@/features/products/queries";
import type { StockMovementFilters } from "@/features/products/schemas";
import { countActiveFilters } from "@/lib/filters";
import { formatRupiah, MONTH_NAMES } from "@/lib/format";
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from "@/lib/stock-types";
import { cn } from "@/lib/utils";

// Masuk = hijau, keluar = netral, opname = amber (koreksi), batal = merah.
const TYPE_TONES: Record<StockMovementType, Tone> = {
  INITIAL: "success",
  PURCHASE: "success",
  PURCHASE_VOID: "danger",
  SALE: "pending",
  SALE_VOID: "danger",
  STOCK_TAKE: "warning",
};

// Satuan barang ikut di tiap baris agar kolom Qty bisa menampilkannya.
type Row = StockMovementItem & { unit: string };

const column = createDataTableColumns<Row>();

const dateColumn = column.accessor("createdAtTime", {
  header: "Waktu",
  sortFn: "basic",
  meta: { className: "whitespace-nowrap text-muted-foreground" },
  cell: ({ row }) => row.original.createdAtLabel,
});

const typeColumn = column.accessor("type", {
  header: "Jenis",
  enableSorting: false,
  cell: ({ row }) => (
    <div>
      <ToneBadge tone={TYPE_TONES[row.original.type]}>{STOCK_MOVEMENT_LABELS[row.original.type]}</ToneBadge>
      {row.original.note && <p className="mt-1 max-w-56 truncate text-xs text-muted-foreground">{row.original.note}</p>}
    </div>
  ),
});

// Kolom tersembunyi untuk pencarian catatan; tampilannya ikut di kolom Jenis.
const noteColumn = column.accessor((row) => row.note ?? "", {
  id: "note",
  header: () => null,
  enableSorting: false,
  meta: { className: "hidden" },
  cell: () => null,
});

const qtyColumn = column.accessor("qty", {
  header: "Qty",
  sortFn: "basic",
  meta: { className: "text-right whitespace-nowrap tabular-nums" },
  cell: ({ row }) => <QtyLabel row={row.original} />,
});

// Qty bertanda: masuk hijau (+), keluar merah (dipakai tabel & kartu).
function QtyLabel({ row }: { row: Row }) {
  return (
    <span className={cn(row.qty > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
      {row.qty > 0 ? "+" : ""}
      {row.qty.toLocaleString("id-ID")} {row.unit}
    </span>
  );
}

const stockAfterColumn = column.accessor("stockAfter", {
  header: "Stok",
  sortFn: "basic",
  meta: { className: "text-right whitespace-nowrap tabular-nums" },
  cell: ({ getValue }) => getValue().toLocaleString("id-ID"),
});

const costColumn = column.accessor((row) => row.costPrice ?? 0, {
  id: "costPrice",
  header: "Harga modal",
  sortFn: "basic",
  meta: { className: "hidden sm:table-cell text-right whitespace-nowrap tabular-nums" },
  cell: ({ row }) => (row.original.costPrice == null ? "-" : formatRupiah(row.original.costPrice)),
});

const byColumn = column.accessor("createdByName", {
  header: "Oleh",
  sortFn: "text",
  meta: { className: "hidden md:table-cell whitespace-nowrap" },
});

// Dibuat sekali di luar komponen (wajib stabil untuk TanStack Table v9).
const COLUMNS_WITH_COST = column.columns([dateColumn, typeColumn, noteColumn, qtyColumn, stockAfterColumn, costColumn, byColumn]);
const COLUMNS_NO_COST = column.columns([dateColumn, typeColumn, noteColumn, qtyColumn, stockAfterColumn, byColumn]);
const SEARCHABLE = ["note", "createdByName"] as const;

const TYPE_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua jenis" },
  ...STOCK_MOVEMENT_TYPES.map((value) => ({ value, label: STOCK_MOVEMENT_LABELS[value] })),
];

const MONTH_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua bulan" },
  ...MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label })),
];

export function StockMovementsTable({
  movements,
  unit,
  withCost,
  filters,
  years,
}: {
  movements: StockMovementItem[];
  unit: string;
  withCost: boolean;
  filters: StockMovementFilters;
  years: number[]; // pilihan filter Tahun
}) {
  const { setFilters, pending } = useUrlFilters();
  const activeFilterCount = countActiveFilters(filters);
  const rows: Row[] = movements.map((movement) => ({ ...movement, unit }));

  const yearOptions: FilterOption[] = [
    { value: FILTER_ALL, label: "Semua tahun" },
    ...years.map((year) => ({ value: String(year), label: String(year) })),
  ];

  return (
    <DataTable
      columns={withCost ? COLUMNS_WITH_COST : COLUMNS_NO_COST}
      data={rows}
      searchableColumns={SEARCHABLE}
      searchPlaceholder="Cari catatan atau nama pencatat"
      emptyMessage={activeFilterCount > 0 ? "Tidak ada mutasi pada filter ini." : "Belum ada mutasi stok."}
      activeFilterCount={activeFilterCount}
      pending={pending}
      renderCard={(row) => <MovementCard row={row} withCost={withCost} />}
      filters={
        <DataTableFilters
          canReset={activeFilterCount > 0}
          pending={pending}
          onReset={() => setFilters({ type: undefined, year: undefined, month: undefined })}
        >
          <DataTableFilterSelect
            label="Jenis"
            value={filters.type ?? FILTER_ALL}
            options={TYPE_OPTIONS}
            onValueChange={(type) => setFilters({ type })}
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

// Kartu satu mutasi stok untuk HP. Isinya sama dengan kolom tabel.
function MovementCard({ row, withCost }: { row: Row; withCost: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <ToneBadge tone={TYPE_TONES[row.type]}>{STOCK_MOVEMENT_LABELS[row.type]}</ToneBadge>
        <span className="font-semibold whitespace-nowrap tabular-nums">
          <QtyLabel row={row} />
        </span>
      </div>
      {row.note && <p className="line-clamp-2 text-sm text-muted-foreground">{row.note}</p>}
      <div className="flex items-end justify-between gap-2 border-t pt-2 text-xs">
        <div className="flex min-w-0 flex-col text-muted-foreground">
          <span>{row.createdAtLabel}</span>
          <span className="truncate">Oleh {row.createdByName}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end tabular-nums">
          <span>
            <span className="text-muted-foreground">Stok </span>
            <span className="font-medium">{row.stockAfter.toLocaleString("id-ID")}</span>
          </span>
          {withCost && (
            <span className="text-muted-foreground">
              Modal {row.costPrice == null ? "-" : formatRupiah(row.costPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
