// Aturan perlindungan bulan sepi untuk paket 6 bulan & 1 tahun
// (BUSINESS-FLOW §14.8). Fungsi murni, dipakai server (tagihan, cron
// penilaian) dan browser (kartu paket, simulasi di Pengaturan platform).
//
// Ringkas: setiap bulan kalender yang seluruhnya masuk masa paket dinilai di
// awal bulan berikutnya. Bila omzet bulan itu turun ≥ batas (%) dibanding
// rata-rata omzet 3 bulan sebelumnya, masa aktif toko ditambah N hari,
// paling banyak `max` kali per paket. Aturan disalin ke tagihan saat tagihan
// dibuat (reliefSnapshot), sehingga perubahan Pengaturan tidak mengurangi
// janji ke toko yang sudah membayar.

import type { PlanMonths } from "./constants";

// Jumlah bulan pembanding sebelum bulan yang dinilai.
export const RELIEF_BASELINE_MONTHS = 3;

export type ReliefSettings = {
  reliefDays: number; // 0 = tidak ditawarkan
  reliefDropPercent: number;
  reliefMax6: number;
  reliefMax12: number;
};

export type ReliefRules = {
  days: number; // tambahan masa aktif per kejadian
  dropPercent: number; // batas penurunan omzet
  max: number; // jatah per paket
};

// Aturan yang ditawarkan untuk satu paket; null = paket ini tanpa perlindungan.
export function reliefRulesFor(settings: ReliefSettings, months: PlanMonths): ReliefRules | null {
  if (months === 1) return null;
  const max = months === 6 ? settings.reliefMax6 : settings.reliefMax12;
  if (settings.reliefDays <= 0 || max <= 0) return null;
  return { days: settings.reliefDays, dropPercent: settings.reliefDropPercent, max };
}

// Kolom snapshot di tabel subscriptions saat tagihan dibuat.
export function reliefSnapshot(settings: ReliefSettings, months: PlanMonths) {
  const rules = reliefRulesFor(settings, months);
  return {
    reliefDays: rules?.days ?? null,
    reliefDropPercent: rules?.dropPercent ?? null,
    reliefMax: rules?.max ?? null,
  };
}

export type ReliefVerdict =
  | { status: "NO_DATA"; baseline: number; dropPercent: null }
  | { status: "GRANTED" | "NOT_MET"; baseline: number; dropPercent: number };

// `revenue` = omzet bulan yang dinilai; `previous` = omzet 3 bulan sebelumnya,
// null bila toko belum ada sepanjang bulan itu. Data belum cukup bila ada
// bulan pembanding yang kosong atau tanpa penjualan sama sekali (kasir belum
// dipakai rutin), agar rata-rata yang kecil/semu tidak memicu perlindungan.
// Perbandingan memakai bilangan bulat agar tidak ada pembulatan:
//   revenue ≤ rata-rata × (100 − batas)%  ⇔  3 × 100 × revenue ≤ total × (100 − batas)
export function judgeMonth(revenue: number, previous: (number | null)[], dropPercentLimit: number): ReliefVerdict {
  const known = previous.filter((value): value is number => value != null && value > 0);
  const total = known.reduce((sum, value) => sum + value, 0);
  if (known.length < RELIEF_BASELINE_MONTHS) {
    return { status: "NO_DATA", baseline: Math.round(total / RELIEF_BASELINE_MONTHS), dropPercent: null };
  }
  const n = RELIEF_BASELINE_MONTHS;
  const dropPercent = Math.floor(((total - n * revenue) * 100) / total);
  const met = n * 100 * revenue <= total * (100 - dropPercentLimit);
  return { status: met ? "GRANTED" : "NOT_MET", baseline: Math.round(total / n), dropPercent };
}

// Geser bulan kalender: shiftMonth(2026, 1, -1) → { year: 2025, month: 12 }.
export function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// "2026-10-01": hari pertama bulan, untuk membandingkan kolom `date`.
export function firstDayOf(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

// Diskon efektif maksimal (%) bila semua jatah terpakai: membayar harga
// paket (sudah didiskon) untuk masa paket + days × max hari. Satu desimal.
export function effectiveDiscount(discountPercent: number, months: PlanMonths, rules: ReliefRules | null) {
  const periodDays = (months * 365) / 12;
  const extraDays = rules ? rules.days * rules.max : 0;
  const paidShare = ((100 - discountPercent) / 100) * (periodDays / (periodDays + extraDays));
  return Math.round((1 - paidShare) * 1000) / 10;
}
