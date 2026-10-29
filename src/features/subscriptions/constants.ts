// Konstanta fitur langganan yang dipakai server & browser (BUSINESS-FLOW §14).

import type { StoreAccessStatus } from "@/lib/subscription-access";

// Status tagihan di tabel subscriptions. "Habis" tidak disimpan: dihitung
// dari ends_at (lib/subscription-access.ts).
// Pemilik klik "Saya sudah bayar" + bukti → CLAIMED. Admin memeriksa bukti
// dan mengisi nominal yang masuk: cukup → ACTIVE (lunas); kurang → UNDERPAID
// (pemilik mengirim bukti kekurangan pada tagihan yang sama → CLAIMED lagi);
// dana tidak masuk/bukti palsu → REJECTED (status akhir, pemilik mulai lagi
// dari pilihan paket). Memilih paket saja tidak menyimpan apa pun.
// PENDING & CANCELLED hanya untuk baris lama (alur sebelum 29 Okt 2026).
export const SUBSCRIPTION_STATUSES = ["CLAIMED", "UNDERPAID", "ACTIVE", "REJECTED", "PENDING", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  CLAIMED: "Menunggu konfirmasi",
  UNDERPAID: "Kurang bayar",
  ACTIVE: "Lunas",
  REJECTED: "Ditolak",
  PENDING: "Menunggu pembayaran",
  CANCELLED: "Dibatalkan",
};

// Status yang masih "terbuka" (belum lunas/ditolak): satu toko hanya boleh
// punya satu. PENDING ikut dijaga untuk baris lama.
export const OPEN_SUBSCRIPTION_STATUSES = ["CLAIMED", "UNDERPAID", "PENDING"] as const;

// Status satu pembayaran (subscription_payments).
export const PAYMENT_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Menunggu konfirmasi",
  ACCEPTED: "Diterima",
  REJECTED: "Ditolak",
};

// Bukti transfer: gambar/PDF maksimal 3 MB.
export const PROOF_MAX_BYTES = 3 * 1024 * 1024;
export const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

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

