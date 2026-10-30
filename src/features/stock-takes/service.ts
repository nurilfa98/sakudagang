// Aturan bisnis stok opname (fungsi murni, tanpa DB) — BUSINESS-FLOW §9.

// Selisih = fisik − sistem. Negatif = barang kurang (susut), positif = lebih.
export function stockTakeDifference(physicalQty: number, systemQty: number) {
  return physicalQty - systemQty;
}

// Penyusutan hanya dari selisih kurang: |selisih| × harga modal. Selisih
// lebih hanya koreksi stok, tidak menambah laba (barang sudah dibayar
// sebelumnya; kelebihan ini pencatatan yang kurang, bukan untung).
export function shrinkageValue(difference: number, costPrice: number) {
  return difference < 0 ? -difference * costPrice : 0;
}

// Barang yang dihitung dengan selisih ≠ 0 tetapi belum diberi alasan.
export function itemsMissingReason<T extends { physicalQty: number | null; systemQty: number; reason: string | null }>(
  items: T[],
) {
  return items.filter(
    (item) => item.physicalQty !== null && stockTakeDifference(item.physicalQty, item.systemQty) !== 0 && !item.reason,
  );
}
