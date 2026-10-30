// Tombol "Batalkan pembelian" + dialog alasan di halaman detail pembelian.
// Pembatalan mengurangi stok lagi dan menghitung ulang harga modal; ditolak
// server bila barangnya sudah terjual (stok akan minus).

"use client";

import { VoidAction } from "@/components/void-action";
import { voidPurchase } from "@/features/purchases/actions";

export function VoidPurchaseAction({ purchaseId, number }: { purchaseId: string; number: string }) {
  return (
    <VoidAction
      title="Batalkan pembelian"
      description="Pembelian tidak bisa diedit. Bila salah input, batalkan lalu catat ulang."
      dialogTitle={`Batalkan ${number}?`}
      dialogDescription="Stok setiap barang dikurangi sebesar jumlah pembelian ini dan harga modal dihitung ulang tanpa pembelian ini. Harga jual yang sempat diubah tidak dikembalikan. Pembelian tetap tampil di riwayat dengan status Dibatalkan."
      confirmLabel="Batalkan pembelian"
      reasonPlaceholder="Salah input harga beli gula"
      successMessage={`${number} dibatalkan. Stok dan harga modal sudah dihitung ulang.`}
      onVoid={(reason) => voidPurchase(purchaseId, reason)}
    />
  );
}
