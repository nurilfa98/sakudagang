// Cara bayar langganan: tiap rekening bank (bisa lebih dari satu, dari
// Pengaturan) dan/atau QRIS statis. Kartu berjajar ke samping di layar lebar
// dan bertumpuk di HP; yang tampil hanya yang ada datanya (QRIS saja bila
// tidak ada rekening). Tanpa hooks, boleh dirender di server maupun browser.

import { bankAccentClass, formatAccountNumber } from "@/lib/bank";
import { cn } from "@/lib/utils";

export type PaymentBank = {
  id: string;
  bankName: string;
  accountNumber: string; // angka saja
  accountName: string;
};

// Bagian Pengaturan yang boleh dikirim ke browser (tanpa key file QRIS).
export type PaymentInfo = {
  banks: PaymentBank[];
  hasQris: boolean;
  adminPhone: string | null;
};

export function PaymentInstructions({ payment }: { payment: PaymentInfo }) {
  if (payment.banks.length === 0 && !payment.hasQris) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Cara pembayaran belum diatur. Hubungi admin SakuDagang.
      </p>
    );
  }

  return (
    // auto-fit: sebanyak mungkin kartu per baris (min. 14rem), sisanya turun.
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
      {payment.banks.map((bank) => (
        // Garis tepi & nama bank memakai warna khas bank (lib/bank.ts).
        <div key={bank.id} className={cn("rounded-lg border-2 p-4", bankAccentClass(bank.bankName))}>
          <p className="text-sm font-semibold">Transfer {bank.bankName}</p>
          <dl className="mt-2 text-sm">
            <dt className="text-muted-foreground">Nomor rekening</dt>
            <dd className="font-mono text-base text-foreground tabular-nums">{formatAccountNumber(bank.bankName, bank.accountNumber)}</dd>
            <dt className="mt-1 text-muted-foreground">Atas nama</dt>
            <dd className="text-foreground">{bank.accountName}</dd>
          </dl>
        </div>
      ))}
      {payment.hasQris && (
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">QRIS</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- gambar dilayani route /api/qris setelah cek login */}
          <img src="/api/qris" alt="QRIS SakuDagang" className="mt-2 w-full max-w-56 rounded-md border bg-white" />
        </div>
      )}
    </div>
  );
}
