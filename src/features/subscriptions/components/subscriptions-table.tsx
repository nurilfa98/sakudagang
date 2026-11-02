// Data table riwayat tagihan (Client Component, memakai components/data-table).
// Dipakai halaman Langganan (satu toko) dan halaman Tagihan (Superadmin,
// semua toko + kolom Toko + aksi tandai lunas/batalkan).
//
// Pencarian nama toko/catatan di browser; filter Status/Tahun/Toko lewat URL
// dan diterapkan server (docs/ARCHITECTURE.md §3 "Daftar data").
// HP (< md): kartu (SubscriptionCard), 10 dulu lalu +10 saat di-scroll.

"use client";

import { createDataTableColumns, DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilters,
  DataTableFilterSelect,
  FILTER_ALL,
  useUrlFilters,
  type FilterOption,
} from "@/components/data-table/data-table-filters";
import { PLAN_LABELS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUSES } from "@/features/subscriptions/constants";
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
  cell: ({ row }) => row.original.createdAtLabel,
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
  cell: ({ row }) => (
    <div className="flex flex-col items-end">
      <span>{formatRupiah(row.original.price)}</span>
      <UnderpaidNote row={row.original} />
    </div>
  ),
});

// Riwayat kurang bayar tetap tampil (juga saat menunggu konfirmasi pelunasan)
// sampai tagihan lunas, agar admin tahu konteksnya. Dipakai tabel & kartu.
function UnderpaidNote({ row }: { row: SubscriptionItem }) {
  if (!(row.amountPaid > 0 && row.amountPaid < row.price)) return null;
  return (
    <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
      diterima {formatRupiah(row.amountPaid)}, kurang {formatRupiah(row.price - row.amountPaid)}
    </span>
  );
}

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

const rejectionColumn = column.accessor((row) => row.rejectionNote ?? "", {
  id: "rejection",
  header: "Alasan ditolak",
  enableSorting: false,
  meta: { className: "hidden lg:table-cell" },
  cell: ({ row }) =>
    row.original.rejectionNote ? (
      <span className="block max-w-56 truncate" title={row.original.rejectionNote}>
        {row.original.rejectionNote}
      </span>
    ) : (
      <span className="text-muted-foreground">-</span>
    ),
});

const actionsColumn = column.display({
  id: "actions",
  header: () => <span className="sr-only">Aksi</span>,
  meta: { className: "w-10 text-right" },
  // Aksi hanya saat ada pembayaran yang menunggu konfirmasi; kurang bayar
  // menunggu pemilik mengirim bukti berikutnya.
  cell: ({ row }) => (row.original.pendingPayment ? <BillingRowActions subscription={row.original} /> : null),
});

// Dibuat sekali di luar komponen (wajib stabil untuk TanStack Table v9).
const COLUMNS_STORE = column.columns([
  dateColumn,
  planColumn,
  amountColumn,
  periodColumn,
  noteColumn,
  statusColumn,
  rejectionColumn,
]);
const COLUMNS_PLATFORM = column.columns([
  dateColumn,
  storeColumn,
  planColumn,
  amountColumn,
  periodColumn,
  noteColumn,
  statusColumn,
  rejectionColumn,
  actionsColumn,
]);
const SEARCHABLE = ["storeName", "note", "rejection"] as const;

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
      renderCard={(row) => <SubscriptionCard row={row} platform={platform} />}
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

// Kartu satu tagihan untuk HP. Di halaman Tagihan (platform) ada nama toko dan
// tombol aksi bila ada pembayaran yang menunggu konfirmasi.
function SubscriptionCard({ row, platform }: { row: SubscriptionItem; platform: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{platform ? row.storeName : `Paket ${PLAN_LABELS[row.months]}`}</span>
          <span className="text-xs text-muted-foreground">
            {platform && `Paket ${PLAN_LABELS[row.months]} · `}Dibuat {row.createdAtLabel}
          </span>
        </div>
        <SubscriptionStatusBadge status={row.status} />
      </div>
      {row.note && <p className="line-clamp-2 text-sm text-muted-foreground">{row.note}</p>}
      {row.rejectionNote && (
        <p className="line-clamp-2 text-sm text-rose-700 dark:text-rose-300">Ditolak: {row.rejectionNote}</p>
      )}
      <div className="flex items-end justify-between gap-2 border-t pt-2">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="text-muted-foreground">Periode</span>
          <span>{row.periodLabel ?? "-"}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex flex-col items-end">
            <span className="font-semibold whitespace-nowrap tabular-nums">{formatRupiah(row.price)}</span>
            <UnderpaidNote row={row} />
          </div>
          {platform && row.pendingPayment && <BillingRowActions subscription={row} />}
        </div>
      </div>
    </div>
  );
}
