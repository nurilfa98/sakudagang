// Aturan bisnis penjualan (fungsi murni, tanpa DB) — BUSINESS-FLOW §5.

// Satu baris: subtotal = harga jual × qty, laba kotor = (jual − modal) × qty.
export function calculateSaleLine(qty: number, sellingPrice: number, costPrice: number) {
  return { subtotal: qty * sellingPrice, grossProfit: (sellingPrice - costPrice) * qty };
}

// Total transaksi: omset, HPP (uang modal yang harus diputar), laba kotor.
export function calculateSaleTotals(lines: { qty: number; sellingPrice: number; costPrice: number }[]) {
  return lines.reduce(
    (totals, line) => {
      const { subtotal, grossProfit } = calculateSaleLine(line.qty, line.sellingPrice, line.costPrice);
      return {
        total: totals.total + subtotal,
        totalCost: totals.totalCost + line.qty * line.costPrice,
        totalGrossProfit: totals.totalGrossProfit + grossProfit,
      };
    },
    { total: 0, totalCost: 0, totalGrossProfit: 0 },
  );
}

// Kasir boleh mengubah harga jual per transaksi (diskon/pembulatan) tetapi
// tidak di bawah harga modal; Pemilik boleh (BUSINESS-FLOW §5.1).
export function isPriceAllowed(sellingPrice: number, costPrice: number, canSellBelowCost: boolean) {
  return canSellBelowCost || sellingPrice >= costPrice;
}

// Siapa boleh membatalkan (BUSINESS-FLOW §5.4): Pemilik semua penjualan
// kapan pun; Kasir hanya miliknya sendiri pada hari yang sama (tanggal
// menurut zona waktu toko).
export function canVoidSale({
  canVoidAll,
  actorId,
  today,
  sale,
}: {
  canVoidAll: boolean;
  actorId: string;
  today: string;
  sale: { createdById: string; date: string };
}) {
  return canVoidAll || (sale.createdById === actorId && sale.date === today);
}
