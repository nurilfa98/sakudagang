// Pengganti tabel biasa (bukan DataTable) di HP (< md, 768px), supaya tidak
// perlu geser ke samping. Pola: tabel dibungkus <DesktopTable> (tampil mulai
// md), lalu isi yang sama ditulis ulang sebagai <MobileList> (hanya di HP).
// Keduanya dirender sekaligus dan dipilih lewat CSS, sama seperti tampilan
// kartu DataTable (components/data-table/data-table.tsx).
//
// Tabel-tabel ini berada di dalam Card, jadi di HP berupa daftar baris yang
// dipisah garis (bukan kartu bertepi) agar tidak ada kotak di dalam kotak.
//
//   <DesktopTable><Table>...</Table></DesktopTable>
//   <MobileList>
//     <MobileListItem>...</MobileListItem>
//     <MobileListTotal label="Total" value="Rp 120.000" />
//   </MobileList>

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DesktopTable({ children }: { children: ReactNode }) {
  return <div className="hidden md:block">{children}</div>;
}

export function MobileList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("flex flex-col divide-y md:hidden", className)}>{children}</ul>;
}

// `relative`: link dengan `after:absolute after:inset-0` membuat seluruh baris bisa diklik.
export function MobileListItem({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("relative flex flex-col gap-1 py-3 first:pt-0 last:pb-0", className)}>{children}</li>;
}

// Baris atas item: judul di kiri, angka utama di kanan.
export function MobileListRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-start justify-between gap-3", className)}>{children}</div>;
}

// Baris total di akhir daftar (pengganti <TableFooter>).
export function MobileListTotal({ label, value, extra }: { label: string; value: ReactNode; extra?: ReactNode }) {
  return (
    <li className="flex flex-col gap-1 py-3 last:pb-0">
      <div className="flex items-baseline justify-between gap-3 font-semibold">
        <span>{label}</span>
        <span className="whitespace-nowrap tabular-nums">{value}</span>
      </div>
      {extra}
    </li>
  );
}
