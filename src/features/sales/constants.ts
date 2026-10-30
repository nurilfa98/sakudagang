// Konstanta fitur penjualan (kasir) yang dipakai server & browser.

export const PAYMENT_METHODS = [
  "CASH", // tunai: uang masuk hari itu, kasir mengisi uang diterima
  "QRIS", // non-tunai: uang masuk hari itu
  "CREDIT", // bon: wajib pelanggan, menjadi piutang sampai dilunasi
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  CREDIT: "Bon",
};

export const SALE_STATUSES = [
  "COMPLETED", // tersimpan, stok sudah dipotong
  "VOIDED", // dibatalkan: stok dikembalikan, tidak dihitung di laporan
] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number];

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETED: "Selesai",
  VOIDED: "Dibatalkan",
};

// PAID = tunai/QRIS (langsung lunas) atau bon yang sudah dilunasi; UNPAID = bon.
export const SALE_PAYMENT_STATUSES = ["PAID", "UNPAID"] as const;

export type SalePaymentStatus = (typeof SALE_PAYMENT_STATUSES)[number];

// Batas baris per transaksi; keranjang warung jarang lebih dari ini.
export const MAX_SALE_ITEMS = 200;
