// Tab laporan (Harian / Bulanan / Tahunan) + pemilih periode di satu baris,
// di atas semua isi laporan (filter mencakup semua angka di bawahnya).
// Periode disimpan di URL (?date= / ?year=&month= / ?year=).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";
import { useUrlFilters } from "@/components/data-table/data-table-filters";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/reports/daily", label: "Harian" },
  { href: "/reports/monthly", label: "Bulanan" },
  { href: "/reports/yearly", label: "Tahunan" },
] as const;

export function ReportPeriodPicker({
  mode,
  date,
  year,
  month,
  years,
  today,
  action,
}: {
  mode: "daily" | "monthly" | "yearly";
  date?: string;
  year?: number;
  month?: number;
  years: number[]; // pilihan tahun (sudah termasuk tahun ini)
  today: string;
  action?: React.ReactNode; // mis. tombol unduh Excel
}) {
  const pathname = usePathname();
  const { setFilters, pending } = useUrlFilters();
  const id = useId();
  const yearItems = years.map((value) => ({ value: String(value), label: String(value) }));
  const monthItems = MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label }));

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", pending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex rounded-lg border p-0.5" aria-label="Jenis laporan">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={pathname === tab.href ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground",
                pathname === tab.href && "bg-brand text-brand-foreground hover:text-brand-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {mode === "daily" && (
          <Input
            id={id}
            type="date"
            value={date}
            max={today}
            onChange={(event) => setFilters({ date: event.target.value || undefined })}
            className="w-44"
            aria-label="Tanggal laporan"
          />
        )}

        {mode === "monthly" && (
          <Select value={String(month)} onValueChange={(value) => setFilters({ month: String(value) })} items={monthItems}>
            <SelectTrigger className="w-36" aria-label="Bulan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {mode !== "daily" && (
          <Select value={String(year)} onValueChange={(value) => setFilters({ year: String(value) })} items={yearItems}>
            <SelectTrigger className="w-28" aria-label="Tahun">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {action}
    </div>
  );
}
