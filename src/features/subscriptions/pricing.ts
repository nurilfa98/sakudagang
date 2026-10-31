// Rumus harga paket standar (pola sama dengan ArchiPay, tanpa batas pengguna):
//
//   paket N bulan = harga per bulan × N × (100 − diskon N bulan) / 100
//
// Fungsi murni, dipakai server (harga yang disimpan ke subscription_plans) dan
// browser (kalkulasi otomatis + tabel simulasi di Pengaturan platform),
// sehingga angka yang dilihat Superadmin sama dengan yang ditagih.

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
