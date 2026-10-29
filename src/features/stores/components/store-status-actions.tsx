// Tombol "Nonaktifkan/Aktifkan toko" di halaman detail toko (Superadmin).
// Berdampak ke semua user toko, jadi selalu meminta konfirmasi.

"use client";

import { ActionRow, ConfirmButton } from "@/components/confirm-button";
import { setStoreActive } from "@/features/stores/actions";
import type { StoreDetail } from "@/features/stores/queries";
import { notify } from "@/lib/notify";

export function StoreStatusActions({ store }: { store: StoreDetail }) {
  async function handleToggle() {
    const result = await setStoreActive(store.id, !store.isActive);
    if (!result.success) notify.error(result.message);
    else notify.success(store.isActive ? "Toko dinonaktifkan." : "Toko diaktifkan kembali.");
  }

  return (
    <ActionRow
      title={store.isActive ? "Nonaktifkan toko" : "Aktifkan toko"}
      description={
        store.isActive
          ? "Semua pengguna toko ini (pemilik & kasir) langsung tidak bisa login. Data & riwayat tetap tersimpan."
          : "Pengguna toko ini bisa login kembali."
      }
    >
      <ConfirmButton
        label={store.isActive ? "Nonaktifkan" : "Aktifkan"}
        variant={store.isActive ? "destructive" : "outline"}
        dialogTitle={store.isActive ? `Nonaktifkan ${store.name}?` : `Aktifkan ${store.name}?`}
        dialogDescription={
          store.isActive
            ? "Dipakai saat langganan berhenti. Anda bisa mengaktifkannya kembali kapan saja."
            : "Pemilik dan kasir toko ini bisa login kembali dengan password terakhirnya."
        }
        confirmLabel={store.isActive ? "Nonaktifkan" : "Aktifkan"}
        onConfirm={handleToggle}
      />
    </ActionRow>
  );
}
