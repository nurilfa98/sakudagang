// Data table daftar pengguna (Client Component, memakai components/data-table).
//
// - Pencarian nama/email/WhatsApp di browser; filter Toko (Superadmin)/Role/
//   Status lewat URL dan diterapkan server (docs/ARCHITECTURE.md §3).
// - Kolom Toko hanya untuk Superadmin (melihat lintas toko).
// - `filters` opsional: halaman detail toko memakai tabel ini tanpa panel
//   filter (hanya pencarian & halaman).
// - Seluruh baris bisa diklik lewat link di kolom Nama.

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
import type { UserListItem } from "@/features/users/queries";
import type { UserFilters } from "@/features/users/schemas";
import { ASSIGNABLE_ROLES } from "@/features/users/service";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { countActiveFilters } from "@/lib/filters";
import { formatPhone } from "@/lib/phone";
import { RoleBadge, UserStatusBadge } from "./user-badges";

type Row = UserListItem & { phoneLabel: string };

const column = createDataTableColumns<Row>();

const nameColumn = column.accessor("fullName", {
  header: "Nama",
  sortFn: "text",
  cell: ({ row }) => (
    <div className="max-w-56 sm:max-w-none">
      {/* Di HP badge role sebaris dengan nama agar baris tidak tinggi;
          di layar ≥ 640px role punya kolom sendiri. */}
      <div className="flex items-center gap-2">
        <Link href={`/users/${row.original.id}`} className="truncate font-medium after:absolute after:inset-0 hover:underline">
          {row.original.fullName}
        </Link>
        <RoleBadge role={row.original.role} className="sm:hidden" />
      </div>
      <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
    </div>
  ),
});

// Kolom tersembunyi agar email ikut dicari; tampilannya ada di kolom Nama.
const emailColumn = column.accessor("email", {
  header: () => null,
  enableSorting: false,
  meta: { className: "hidden" },
  cell: () => null,
});

const storeColumn = column.accessor((row) => row.storeName ?? "", {
  id: "storeName",
  header: "Toko",
  sortFn: "text",
  meta: { className: "hidden md:table-cell" },
  cell: ({ row }) => row.original.storeName ?? "-",
});

const phoneColumn = column.accessor("phoneLabel", {
  header: "WhatsApp",
  enableSorting: false,
  meta: { className: "hidden lg:table-cell whitespace-nowrap" },
  cell: ({ getValue }) => getValue() || "-",
});

const roleColumn = column.accessor("role", {
  header: "Role",
  sortFn: "text",
  meta: { className: "hidden sm:table-cell" },
  cell: ({ row }) => <RoleBadge role={row.original.role} />,
});

const statusColumn = column.accessor((row) => (!row.isActive ? 2 : row.mustChangePassword ? 1 : 0), {
  id: "status",
  header: "Status",
  sortFn: "basic",
  cell: ({ row }) => <UserStatusBadge user={row.original} />,
});

const openColumn = column.display({
  id: "open",
  header: () => <span className="sr-only">Detail</span>,
  meta: { className: "w-10" },
  cell: () => <ChevronRightIcon className="size-4 text-muted-foreground" />,
});

// Dibuat sekali di luar komponen (wajib stabil untuk TanStack Table v9).
const COLUMNS_WITH_STORE = column.columns([nameColumn, emailColumn, storeColumn, phoneColumn, roleColumn, statusColumn, openColumn]);
const COLUMNS_OWN_STORE = column.columns([nameColumn, emailColumn, phoneColumn, roleColumn, statusColumn, openColumn]);
const SEARCHABLE = ["fullName", "email", "phoneLabel", "storeName"] as const;

const ROLE_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua role" },
  ...ASSIGNABLE_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

const STATUS_OPTIONS: FilterOption[] = [
  { value: FILTER_ALL, label: "Semua status" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PENDING", label: "Menunggu login" },
  { value: "INACTIVE", label: "Nonaktif" },
];

export function UsersTable({
  users,
  showStore,
  filters,
  storeOptions = [],
}: {
  users: UserListItem[];
  showStore: boolean;
  // Tanpa `filters`: tabel tanpa panel filter (pencarian & halaman saja).
  filters?: UserFilters;
  storeOptions?: FilterOption[]; // pilihan toko (Superadmin)
}) {
  const { setFilters, pending } = useUrlFilters();
  const activeFilterCount = filters ? countActiveFilters(filters) : 0;
  const rows: Row[] = users.map((user) => ({ ...user, phoneLabel: user.phone ? formatPhone(user.phone) : "" }));

  return (
    <DataTable
      columns={showStore ? COLUMNS_WITH_STORE : COLUMNS_OWN_STORE}
      data={rows}
      searchableColumns={SEARCHABLE}
      searchPlaceholder="Cari nama, email, atau WhatsApp"
      emptyMessage={activeFilterCount > 0 ? "Tidak ada pengguna pada filter ini." : "Belum ada pengguna."}
      activeFilterCount={activeFilterCount}
      pending={pending}
      filters={
        filters && (
          <DataTableFilters
            canReset={activeFilterCount > 0}
            pending={pending}
            onReset={() => setFilters({ storeId: undefined, role: undefined, status: undefined })}
          >
            {showStore && (
              <DataTableFilterSelect
                label="Toko"
                value={filters.storeId ?? FILTER_ALL}
                options={[{ value: FILTER_ALL, label: "Semua toko" }, ...storeOptions]}
                onValueChange={(storeId) => setFilters({ storeId })}
              />
            )}
            <DataTableFilterSelect
              label="Role"
              value={filters.role ?? FILTER_ALL}
              options={ROLE_OPTIONS}
              onValueChange={(role) => setFilters({ role })}
            />
            <DataTableFilterSelect
              label="Status"
              value={filters.status ?? FILTER_ALL}
              options={STATUS_OPTIONS}
              onValueChange={(status) => setFilters({ status })}
            />
          </DataTableFilters>
        )
      }
    />
  );
}
