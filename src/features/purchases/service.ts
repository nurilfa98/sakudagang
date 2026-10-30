// Aturan bisnis pembelian (fungsi murni, tanpa DB). Harga modal rata-rata
// tertimbang ada di features/products/service.ts (calculateAverageCost).

// Total pembelian = Σ harga beli × qty = modal keluar pada tanggal itu (BUSINESS-FLOW §4).
export function calculatePurchaseTotal(items: { qty: number; unitCost: number }[]) {
  return items.reduce((total, item) => total + item.qty * item.unitCost, 0);
}

// Pembatalan ditolak bila stok barang akan menjadi minus: artinya sebagian
// barang dari pembelian ini sudah terjual (atau sudah dikoreksi opname), dan
// penyesuaiannya lewat stok opname, bukan pembatalan (BUSINESS-FLOW §4).
export function canVoidPurchaseItem(currentStock: number, purchasedQty: number) {
  return currentStock - purchasedQty >= 0;
}

// "2026-10-24" → { year: 2026, month: 10 }, periode nomor & filter pembelian.
export function periodOfDate(date: string) {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}
