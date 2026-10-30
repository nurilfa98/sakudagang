const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

// Nominal di database disimpan dalam rupiah (lihat lib/db/schema.ts).
export function formatRupiah(amount: number) {
  return rupiah.format(amount);
}

// Nama bulan, indeks 0 = Januari. Untuk pilihan filter bulan.
export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const compactNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

// Nominal ringkas untuk sumbu grafik: 250.000 → "250 rb", 1.500.000 → "1,5 jt",
// 2.000.000.000 → "2 M". Di bawah seribu ditulis penuh.
export function formatCompactRupiah(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (abs >= 1_000_000_000) return `${sign}${compactNumber.format(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}${compactNumber.format(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}${compactNumber.format(abs / 1_000)} rb`;
  return `${sign}${compactNumber.format(abs)}`;
}
