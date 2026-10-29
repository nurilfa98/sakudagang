// Input nominal rupiah: menampilkan pemisah ribuan ("18.500") dengan awalan
// "Rp", hanya menerima angka. Nilai yang terkirim di FormData berisi titik
// ribuan; server membuang semua karakter selain angka (lib/validation.ts).
//
// Dipakai di form barang, pembelian, kasir, pengeluaran.

"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RupiahInputProps = Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "type"> & {
  defaultValue?: number | null;
  onValueChange?: (value: number | null) => void;
};

export function RupiahInput({ defaultValue, onValueChange, className, ...props }: RupiahInputProps) {
  const [digits, setDigits] = useState(defaultValue != null ? String(defaultValue) : "");

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        inputMode="numeric"
        autoComplete="off"
        className={cn("pl-9 tabular-nums", className)}
        value={digits ? Number(digits).toLocaleString("id-ID") : ""}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "").slice(0, 12);
          setDigits(next);
          onValueChange?.(next ? Number(next) : null);
        }}
        {...props}
      />
    </div>
  );
}
