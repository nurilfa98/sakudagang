// Aturan bisnis barang (fungsi murni, tanpa DB).

// Harga modal rata-rata tertimbang (BUSINESS-FLOW.md §4), dibulatkan ke rupiah.
// Bila stok lama ≤ 0 (habis/minus), rata-rata tidak masuk akal → pakai harga beli.
//
//   stok 10 @ 17.000, beli 20 @ 18.500 → (170.000 + 370.000) ÷ 30 = 18.000
export function calculateAverageCost(oldStock: number, oldCostPrice: number, qty: number, unitCost: number) {
  if (oldStock <= 0 || qty <= 0) return unitCost;
  return Math.round((oldStock * oldCostPrice + qty * unitCost) / (oldStock + qty));
}

// Perlu restock: stok minus, atau ≤ stok minimum bila dipantau.
export function isLowStock(stock: number, minStock: number | null) {
  if (stock < 0) return true;
  return minStock !== null && stock <= minStock;
}
