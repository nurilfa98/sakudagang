// Cara bayar langganan: transfer bank dan/atau QRIS statis (dari Pengaturan).
// Dipakai panel pembayaran saat pemilik memilih paket (plan-cards.tsx).
// Tanpa hooks, boleh dirender di server maupun browser.

import { formatAccountNumber } from "@/lib/bank";

// Bagian Pengaturan yang boleh dikirim ke browser (tanpa key file QRIS).
export type PaymentInfo = {
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  hasQris: boolean;
  adminPhone: string | null;
};

export function PaymentInstructions({ payment }: { payment: PaymentInfo }) {
  const hasBank = payment.bankName && payment.bankAccountNumber;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">Transfer bank</p>
        {hasBank ? (
          <dl className="mt-2 text-sm">
            <dt className="text-muted-foreground">Bank</dt>
            <dd>{payment.bankName}</dd>
            <dt className="mt-1 text-muted-foreground">Nomor rekening</dt>
            <dd className="font-mono text-base tabular-nums">
              {formatAccountNumber(payment.bankName, payment.bankAccountNumber ?? "")}
            </dd>
            <dt className="mt-1 text-muted-foreground">Atas nama</dt>
            <dd>{payment.bankAccountName ?? "-"}</dd>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Rekening belum diatur. Hubungi admin.</p>
        )}
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">QRIS</p>
        {payment.hasQris ? (
          // eslint-disable-next-line @next/next/no-img-element -- gambar dilayani route /api/qris setelah cek login
          <img src="/api/qris" alt="QRIS SakuDagang" className="mt-2 w-full max-w-56 rounded-md border bg-white" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">QRIS belum tersedia. Gunakan transfer bank.</p>
        )}
      </div>
    </div>
  );
}
