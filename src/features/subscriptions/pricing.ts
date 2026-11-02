// Rumus harga paket standar (pola sama dengan ArchiPay, tanpa batas pengguna):
//
//   paket N bulan = harga per bulan × N × (100 − diskon N bulan) / 100
//
// Rumus yang sama dipakai untuk harga khusus per toko (store_plan_prices).
//
// Fungsi murni, dipakai server (harga yang disimpan ke subscription_plans /
// store_plan_prices) dan browser (kalkulasi otomatis + tabel simulasi di
// Pengaturan platform & detail toko), sehingga angka yang dilihat Superadmin
// sama dengan yang ditagih.

import type { PlanMonths } from "./constants";

export type Pricing = {
  monthlyPrice: number; // 0 = paket belum dijual
  discount6: number; // persen
  discount12: number; // persen
};

export function discountOf(pricing: Pricing, months: PlanMonths) {
  return months === 6 ? pricing.discount6 : months === 12 ? pricing.discount12 : 0;
}

export function planPrice(pricing: Pricing, months: PlanMonths) {
  return Math.round((pricing.monthlyPrice * months * (100 - discountOf(pricing, months))) / 100);
}

// Kebalikan planPrice: diskon (%) yang menghasilkan harga `total` untuk paket
// N bulan, dibulatkan & dibatasi 0–90. Dipakai mengisi awal form harga khusus
// dari harga per periode yang tersimpan.
export function discountFromPrice(monthlyPrice: number, total: number, months: PlanMonths) {
  if (monthlyPrice <= 0 || months === 1) return 0;
  const discount = Math.round(100 - (total * 100) / (monthlyPrice * months));
  return Math.min(90, Math.max(0, discount));
}
