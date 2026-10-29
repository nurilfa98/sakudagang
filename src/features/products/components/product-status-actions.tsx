// Tombol "Nonaktifkan/Aktifkan barang" di halaman detail barang.
// Barang nonaktif tidak muncul di kasir; riwayatnya tetap ada.

"use client";

import { ActionRow, ConfirmButton } from "@/components/confirm-button";
import { setProductActive } from "@/features/products/actions";
import type { ProductDetail } from "@/features/products/queries";
import { notify } from "@/lib/notify";

export function ProductStatusActions({ product }: { product: ProductDetail }) {
  async function handleToggle() {
    const result = await setProductActive(product.id, !product.isActive);
    if (!result.success) notify.error(result.message);
    else notify.success(product.isActive ? "Barang dinonaktifkan." : "Barang diaktifkan kembali.");
  }

  return (
    <ActionRow
      title={product.isActive ? "Nonaktifkan barang" : "Aktifkan barang"}
      description={
        product.isActive
          ? "Barang tidak muncul di kasir dan daftar bawaan. Riwayat transaksinya tetap tersimpan."
          : "Barang muncul kembali di kasir."
      }
    >
      <ConfirmButton
        label={product.isActive ? "Nonaktifkan" : "Aktifkan"}
        variant={product.isActive ? "destructive" : "outline"}
        dialogTitle={product.isActive ? `Nonaktifkan ${product.name}?` : `Aktifkan ${product.name}?`}
        dialogDescription={
          product.isActive
            ? "Dipakai untuk barang yang tidak dijual lagi. Bisa diaktifkan kembali kapan saja."
            : "Barang bisa dijual kembali di kasir."
        }
        confirmLabel={product.isActive ? "Nonaktifkan" : "Aktifkan"}
        onConfirm={handleToggle}
      />
    </ActionRow>
  );
}
