// Konstanta fitur langganan yang dipakai server & browser (BUSINESS-FLOW §14).

import type { StoreAccessStatus } from "@/lib/subscription-access";

// Status tagihan di tabel subscriptions. "Habis" tidak disimpan: dihitung
// dari ends_at (lihat service.ts getStoreAccess).
export const SUBSCRIPTION_STATUSES = ["PENDING", "ACTIVE", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  PENDING: "Menunggu pembayaran",
  ACTIVE: "Lunas",
  CANCELLED: "Dibatalkan",
};

// Periode paket yang dijual. Harga tiap periode diatur di Pengaturan.
export const PLAN_MONTHS = [1, 6, 12] as const;
export type PlanMonths = (typeof PLAN_MONTHS)[number];

export const PLAN_LABELS: Record<PlanMonths, string> = {
  1: "1 bulan",
  6: "6 bulan",
  12: "1 tahun",
};

// Status akses toko (turunan, lib/subscription-access.ts), BUSINESS-FLOW §14.6.
export const STORE_ACCESS_LABELS: Record<StoreAccessStatus, string> = {
  TRIAL: "Masa gratis",
  ACTIVE: "Langganan aktif",
  GRACE: "Masa tenggang",
  EXPIRED: "Langganan habis",
};

