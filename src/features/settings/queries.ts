// Query Pengaturan platform yang berupa daftar: rekening bank tujuan transfer.
// Pemanggil WAJIB sudah mengecek hak akses (halaman Pengaturan: settings:manage;
// halaman Langganan: subscription:view). Penjelasan `await io()` ada di
// features/stores/queries.ts.

import "server-only";
import { asc } from "drizzle-orm";
import { io } from "next/cache";
import { db } from "@/lib/db";
import { paymentBankAccounts } from "@/lib/db/schema";

export type BankAccountItem = {
  id: string;
  bankName: string;
  accountNumber: string; // angka saja; format strip di UI (lib/bank.ts)
  accountName: string;
};

// Urut sesuai urutan dibuat; boleh kosong (hanya QRIS, atau belum diatur).
export async function listBankAccounts(): Promise<BankAccountItem[]> {
  await io();
  return db
    .select({
      id: paymentBankAccounts.id,
      bankName: paymentBankAccounts.bankName,
      accountNumber: paymentBankAccounts.accountNumber,
      accountName: paymentBankAccounts.accountName,
    })
    .from(paymentBankAccounts)
    .orderBy(asc(paymentBankAccounts.createdAt));
}
