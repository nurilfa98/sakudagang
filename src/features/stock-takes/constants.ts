// Konstanta fitur stok opname yang dipakai server & browser.

export type StockTakeStatus = "DRAFT" | "COMPLETED";

export const STOCK_TAKE_STATUS_LABELS: Record<StockTakeStatus, string> = {
  DRAFT: "Sedang dihitung",
  COMPLETED: "Selesai",
};

// Alasan selisih, wajib bila stok fisik ≠ stok sistem (BUSINESS-FLOW §9).
export const STOCK_TAKE_REASONS = ["DAMAGED", "EXPIRED", "LOST", "PERSONAL_USE", "MISCOUNT", "OTHER"] as const;

export type StockTakeReason = (typeof STOCK_TAKE_REASONS)[number];

export const STOCK_TAKE_REASON_LABELS: Record<StockTakeReason, string> = {
  DAMAGED: "Rusak",
  EXPIRED: "Kedaluwarsa",
  LOST: "Hilang",
  PERSONAL_USE: "Dipakai sendiri",
  MISCOUNT: "Salah catat",
  OTHER: "Lainnya",
};
