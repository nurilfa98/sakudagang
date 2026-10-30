// Aturan bisnis barang (fungsi murni, tanpa DB).

// Harga modal rata-rata tertimbang (BUSINESS-FLOW.md §4), dibulatkan ke rupiah.
// Bila stok lama ≤ 0 (habis/minus), rata-rata tidak masuk akal → pakai harga beli.
//
//   stok 10 @ 17.000, beli 20 @ 18.500 → (170.000 + 370.000) ÷ 30 = 18.000
export function calculateAverageCost(oldStock: number, oldCostPrice: number, qty: number, unitCost: number) {
  if (oldStock <= 0 || qty <= 0) return unitCost;
  return Math.round((oldStock * oldCostPrice + qty * unitCost) / (oldStock + qty));
}

// Satu baris mutasi untuk replayAverageCost. unitCost diisi untuk mutasi yang
// membentuk harga modal (stok awal, pembelian yang masih berlaku); null untuk
// mutasi yang hanya mengubah jumlah stok (penjualan, opname).
export type CostReplayEntry = { qty: number; unitCost: number | null };

// Harga modal dihitung ulang dari riwayat (BUSINESS-FLOW §8), dipakai saat
// pembelian dibatalkan: mutasi diputar ulang urut waktu tanpa pembelian yang
// dibatalkan. Stok berjalan ikut dihitung karena rata-rata tertimbang
// bergantung pada stok saat setiap pembelian terjadi.
//
//   stok awal 10 @ 17.000, jual 4, beli 20 @ 18.500 (dibatalkan)
//   → hanya stok awal yang membentuk harga → 17.000
export function replayAverageCost(entries: CostReplayEntry[]) {
  let stock = 0;
  let cost = 0;
  for (const entry of entries) {
    if (entry.unitCost !== null) cost = calculateAverageCost(stock, cost, entry.qty, entry.unitCost);
    stock += entry.qty;
  }
  return cost;
}

// Perlu restock: stok minus, atau ≤ stok minimum bila dipantau.
export function isLowStock(stock: number, minStock: number | null) {
  if (stock < 0) return true;
  return minStock !== null && stock <= minStock;
}
