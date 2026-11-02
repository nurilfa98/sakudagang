// Judul + deskripsi di bagian atas setiap halaman, supaya tampilannya seragam.
//
// Komponen ini statis (tidak membaca cookie/database), jadi ikut dirender saat
// build dan ikut di-prefetch. Saat menu diklik, judul halaman
// langsung muncul tanpa menunggu server.

// `action` (opsional) = tombol di kanan judul, misalnya "Tambah pengguna".
// Di HP tombol turun ke bawah judul, kecuali `actionInline`: tombol tetap
// sejajar di kanan judul di semua ukuran layar (misal "Kembali ke menu" di Kasir).

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  actionInline = false,
}: {
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  actionInline?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3",
        actionInline ? "flex-row items-center justify-between" : "flex-col sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
