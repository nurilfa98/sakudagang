// Tombol "Batalkan penjualan" + dialog alasan di halaman detail penjualan.
// Hanya ditampilkan bila user boleh membatalkan (Pemilik, atau Kasir untuk
// transaksinya sendiri di hari yang sama); server tetap memeriksa ulang.

"use client";

import { VoidAction } from "@/components/void-action";
import { voidSale } from "@/features/sales/actions";

export function VoidSaleAction({ saleId, number }: { saleId: string; number: string }) {
  return (
    <VoidAction
      title="Batalkan penjualan"
      description="Penjualan tidak bisa diedit. Bila salah input, batalkan lalu buat transaksi baru."
      dialogTitle={`Batalkan ${number}?`}
      dialogDescription="Stok setiap barang dikembalikan dan omset/laba hari itu berkurang. Penjualan tetap tampil di riwayat dengan status Dibatalkan."
      confirmLabel="Batalkan penjualan"
      reasonPlaceholder="Salah input jumlah, pembeli batal"
      successMessage={`${number} dibatalkan. Stok sudah dikembalikan.`}
      onVoid={(reason) => voidSale(saleId, reason)}
    />
  );
}
