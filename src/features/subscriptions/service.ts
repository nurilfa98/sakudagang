// Aturan harga & tampilan paket langganan (BUSINESS-FLOW §14.1). Fungsi murni,
// dipakai server dan browser. Aturan akses (masa gratis, tenggang, kunci)
// ada di lib/subscription-access.ts karena dipakai juga oleh DAL.

import type { PlanMonths } from "./constants";

// Setara per bulan, dibulatkan ke rupiah.
export function monthlyEquivalent(price: number, months: PlanMonths) {
  return Math.round(price / months);
}

// Hemat berapa persen dibanding membayar bulanan selama periode yang sama.
// null bila harga bulanan belum diatur atau paket ini tidak lebih murah.
export function savingsPercent(price: number, months: PlanMonths, monthlyPrice: number) {
  if (months === 1 || monthlyPrice <= 0) return null;
  const full = monthlyPrice * months;
  if (price >= full) return null;
  return Math.round(((full - price) / full) * 100);
}
