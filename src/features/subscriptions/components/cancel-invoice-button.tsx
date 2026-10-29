// Tombol "Batalkan tagihan" (Pemilik di halaman Langganan, Superadmin di
// halaman Tagihan). Meminta konfirmasi karena tagihan tidak bisa dikembalikan.

"use client";

import { ConfirmButton } from "@/components/confirm-button";
import { cancelSubscription } from "@/features/subscriptions/actions";
import { notify } from "@/lib/notify";

export function CancelInvoiceButton({ subscriptionId, compact = false }: { subscriptionId: string; compact?: boolean }) {
  async function handleCancel() {
    const result = await cancelSubscription(subscriptionId);
    if (!result.success) notify.error(result.message);
    else notify.success("Tagihan dibatalkan.");
  }

  return (
    <ConfirmButton
      label={compact ? "Batalkan" : "Batalkan tagihan"}
      variant="ghost"
      dialogTitle="Batalkan tagihan ini?"
      dialogDescription="Tagihan dibatalkan dan bisa dibuat lagi kapan saja dengan memilih paket."
      confirmLabel="Batalkan tagihan"
      onConfirm={handleCancel}
    />
  );
}
