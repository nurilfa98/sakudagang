// Konstanta fitur barang yang dipakai server & browser.

import type { StockMovementType } from "@/lib/stock-types";

// Label jenis mutasi stok untuk riwayat di halaman barang.
export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  INITIAL: "Stok awal",
  PURCHASE: "Pembelian",
  PURCHASE_VOID: "Pembelian dibatalkan",
  SALE: "Penjualan",
  SALE_VOID: "Penjualan dibatalkan",
  STOCK_TAKE: "Stok opname",
};

// Saran satuan (datalist); user tetap boleh mengetik bebas.
export const UNIT_SUGGESTIONS = ["pcs", "bungkus", "botol", "kaleng", "sachet", "kg", "liter", "dus", "ikat"] as const;
