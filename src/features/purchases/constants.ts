// Konstanta fitur pembelian (barang masuk) yang dipakai server & browser.

export const PURCHASE_STATUSES = [
  "COMPLETED", // tersimpan, stok & harga modal sudah bertambah
  "VOIDED", // dibatalkan: stok dikurangi lagi, harga modal dihitung ulang
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  COMPLETED: "Selesai",
  VOIDED: "Dibatalkan",
};

// Batas baris per pembelian; belanja grosir warung jarang lebih dari ini.
export const MAX_PURCHASE_ITEMS = 200;
