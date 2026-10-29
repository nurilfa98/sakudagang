// Jenis mutasi stok. Dipisah dari lib/stock.ts (yang `server-only`) karena
// dipakai juga di browser: label badge dan pilihan filter riwayat mutasi.

export const STOCK_MOVEMENT_TYPES = [
  "INITIAL", // stok awal saat barang dibuat
  "PURCHASE", // pembelian disimpan
  "PURCHASE_VOID", // pembelian dibatalkan
  "SALE", // penjualan disimpan
  "SALE_VOID", // penjualan dibatalkan
  "STOCK_TAKE", // stok opname diselesaikan
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
