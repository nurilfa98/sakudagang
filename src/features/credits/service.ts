// Aturan bisnis bon / piutang (fungsi murni, tanpa DB) — BUSINESS-FLOW §6.

// Sisa bon = total penjualan − Σ pelunasan yang berlaku. Tidak disimpan, dihitung.
export function remainingCredit(total: number, paid: number) {
  return Math.max(total - paid, 0);
}

// Pelunasan boleh sebagian, tetapi tidak melebihi sisa bon.
export function validatePaymentAmount(amount: number, remaining: number) {
  if (remaining <= 0) return "Bon ini sudah lunas.";
  if (amount > remaining) return "Nominal melebihi sisa bon.";
  return null;
}

// Status bayar penjualan bon setelah pelunasan ditambah/dibatalkan.
export function creditPaymentStatus(total: number, paid: number) {
  return paid >= total ? "PAID" : "UNPAID";
}

// Siapa boleh membatalkan pelunasan: mengikuti aturan pembatalan penjualan
// (BUSINESS-FLOW §5.4). Pemilik kapan pun; Kasir hanya yang ia catat sendiri
// pada hari yang sama (tanggal dicatat, bukan tanggal uang diterima).
export function canVoidCreditPayment({
  canVoidAll,
  actorId,
  today,
  payment,
}: {
  canVoidAll: boolean;
  actorId: string;
  today: string;
  payment: { createdById: string; createdDate: string };
}) {
  return canVoidAll || (payment.createdById === actorId && payment.createdDate === today);
}

// Umur bon dalam hari kalender: "2026-10-01" s.d. "2026-10-31" → 30.
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
