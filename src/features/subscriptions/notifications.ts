// Notifikasi WhatsApp ke Pemilik toko setelah admin memeriksa pembayaran
// (BUSINESS-FLOW §14.4): lunas, kurang bayar, atau ditolak. Dikirim ke semua
// Pemilik aktif toko yang punya nomor; gagal kirim tidak membatalkan keputusan
// admin (sendWhatsApp tidak melempar error). Terkirim hanya bila FONNTE_TOKEN
// terisi (lib/whatsapp.ts).

import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { stores, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { formatRupiah } from "@/lib/format";
import { sendWhatsApp } from "@/lib/whatsapp";

export type PaymentOutcome =
  | { kind: "paid"; until: Date }
  | { kind: "underpaid"; received: number; remaining: number; price: number }
  | { kind: "rejected"; reason: string };

export async function notifyOwnersOfPaymentOutcome(storeId: string, outcome: PaymentOutcome) {
  const [store] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return;

  const owners = await db
    .select({ fullName: users.fullName, phone: users.phone })
    .from(users)
    .where(and(eq(users.storeId, storeId), eq(users.role, "OWNER"), eq(users.isActive, true), isNotNull(users.phone)));

  const url = new URL("/subscription", env.NEXT_PUBLIC_APP_URL).toString();
  for (const owner of owners) {
    if (!owner.phone) continue;
    await sendWhatsApp({ to: owner.phone, text: outcomeText(owner.fullName, store.name, outcome, url) });
  }
}

export function outcomeText(ownerName: string, storeName: string, outcome: PaymentOutcome, url: string) {
  const lines =
    outcome.kind === "paid"
      ? [
          `Halo ${ownerName}, pembayaran langganan ${PRODUCT_NAME} untuk toko ${storeName} sudah kami terima.`,
          `Masa aktif toko diperpanjang sampai ${formatDate(outcome.until)}. Terima kasih sudah berlangganan.`,
        ]
      : outcome.kind === "underpaid"
        ? [
            `Halo ${ownerName}, pembayaran ${formatRupiah(outcome.received)} untuk toko ${storeName} sudah kami terima.`,
            `Masih kurang ${formatRupiah(outcome.remaining)} dari tagihan ${formatRupiah(outcome.price)}. Silakan transfer kekurangannya dan kirim buktinya di menu Langganan.`,
          ]
        : [
            `Halo ${ownerName}, bukti pembayaran untuk toko ${storeName} belum bisa kami terima.`,
            `Alasan: ${outcome.reason}. Silakan periksa kembali lalu kirim ulang buktinya di menu Langganan.`,
          ];
  return [...lines, "", url].join("\n");
}
