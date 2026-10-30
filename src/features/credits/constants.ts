// Konstanta fitur bon / piutang yang dipakai server & browser.

// Pelunasan bon hanya tunai atau QRIS (bon tidak bisa dilunasi dengan bon).
export const CREDIT_PAYMENT_METHODS = ["CASH", "QRIS"] as const;

export type CreditPaymentMethod = (typeof CREDIT_PAYMENT_METHODS)[number];

export const CREDIT_PAYMENT_METHOD_LABELS: Record<CreditPaymentMethod, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
};

export type CreditPaymentStatus = "COMPLETED" | "VOIDED";

// Bon dianggap lama (perlu ditagih) setelah sekian hari (BUSINESS-FLOW §10.4).
export const OVERDUE_DAYS = 30;
