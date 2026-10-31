// Kolom pencarian + chip saring status + daftar kartu toko (Superadmin).
// Menyaring langsung di browser saat mengetik, pola sama dengan daftar
// company di ArchiPay.
//
// Kartu dirender di server lalu dikirim ke sini sebagai `entries[].card`,
// bersama teks yang dicari (nama toko, pemilik, jenis usaha) dan statusnya.
// Chip saring diberi titik berwarna sesuai status (../status.ts), sekaligus
// menjadi keterangan arti warna kartu.

"use client";

import { AlarmClockIcon, SearchIcon, XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STORE_STATUS, STORE_STATUSES, type StoreStatus } from "../status";

// SOON = "Segera habis" (masa aktif ≤ 7 hari), lintas status Masa gratis/Aktif.
export type StoreFilter = "ALL" | "SOON" | StoreStatus;

export type StoreSearchEntry = {
  key: string;
  searchText: string;
  status: StoreStatus;
  soon: boolean;
  card: ReactNode;
};

const matches = (entry: StoreSearchEntry, filter: StoreFilter) =>
  filter === "ALL" || (filter === "SOON" ? entry.soon : entry.status === filter);

export function StoreSearchList({ entries }: { entries: StoreSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StoreFilter>("ALL");
  const keyword = query.trim().toLowerCase();

  const byStatus = entries.filter((entry) => matches(entry, filter));
  const visible = keyword ? byStatus.filter((entry) => entry.searchText.toLowerCase().includes(keyword)) : byStatus;
  const countOf = (value: StoreFilter) => entries.filter((entry) => matches(entry, value)).length;
  // Segera habis, Tenggang & Habis hanya tampil bila ada toko-nya.
  const filters: StoreFilter[] = [
    "ALL",
    ...(countOf("SOON") > 0 ? (["SOON"] as const) : []),
    ...STORE_STATUSES.filter((status) => STORE_STATUS[status].alwaysInFilter || countOf(status) > 0),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama toko, pemilik, jenis usaha"
              aria-label="Cari toko"
              className="pl-8"
            />
          </div>
          {query && (
            <Button variant="ghost" size="icon" onClick={() => setQuery("")} aria-label="Hapus pencarian">
              <XIcon />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Saring status toko">
          {filters.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              title={filterTitle(value)}
              className="rounded-full"
            >
              {value === "SOON" && <AlarmClockIcon className="text-amber-600 dark:text-amber-400" />}
              {value !== "ALL" && value !== "SOON" && (
                <span className={cn("size-2 rounded-full", STORE_STATUS[value].dotClass)} />
              )}
              {filterLabel(value)}
              <span className="tabular-nums opacity-70">{countOf(value)}</span>
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {keyword ? `Toko atau pemilik "${query.trim()}" tidak ditemukan.` : "Tidak ada toko dengan status ini."}
        </p>
      ) : (
        // 1 kolom di HP, 2 di tablet, 3 di layar lebar.
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((entry) => (
            <div key={entry.key} className="contents">
              {entry.card}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function filterLabel(value: StoreFilter) {
  if (value === "ALL") return "Semua";
  if (value === "SOON") return "Segera habis";
  return STORE_STATUS[value].label;
}

function filterTitle(value: StoreFilter) {
  if (value === "ALL") return undefined;
  if (value === "SOON") return "Masa gratis/langganan tinggal 7 hari atau kurang";
  return STORE_STATUS[value].description;
}
