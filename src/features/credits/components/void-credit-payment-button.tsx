// Tombol ikon "Batalkan pelunasan" di riwayat pelunasan. Bon kembali belum
// lunas sebesar nominal ini; baris tetap tersimpan dengan alasannya.

"use client";

import { VoidAction } from "@/components/void-action";
import { voidCreditPayment } from "@/features/credits/actions";
import type { CreditPaymentItem } from "@/features/credits/queries";
import { formatRupiah } from "@/lib/format";

export function VoidCreditPaymentButton({ payment }: { payment: CreditPaymentItem }) {
  return (
    <VoidAction
      compact
      title="Batalkan pelunasan"
      description=""
      dialogTitle={`Batalkan pelunasan ${formatRupiah(payment.amount)}?`}
      dialogDescription={`Untuk bon ${payment.saleNumber}, tanggal ${payment.dateLabel}. Sisa bon bertambah lagi sebesar nominal ini. Baris pelunasan tetap tersimpan dengan status Dibatalkan.`}
      confirmLabel="Batalkan pelunasan"
      reasonPlaceholder="Salah catat nominal"
      successMessage="Pelunasan dibatalkan."
      onVoid={(reason) => voidCreditPayment(payment.id, reason)}
    />
  );
}
