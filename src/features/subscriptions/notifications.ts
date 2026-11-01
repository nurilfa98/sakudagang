// Notifikasi WhatsApp ke Pemilik toko (BUSINESS-FLOW §14.4): hasil
// pemeriksaan pembayaran oleh admin (lunas, kurang bayar, ditolak) dan
// perlindungan bulan sepi (diberikan / dibatalkan, §14.8). Dikirim ke semua
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
  await sendToOwners(storeId, (ownerName, storeName, url) => outcomeText(ownerName, storeName, outcome, url));
}

export type ReliefNotice =
  | { kind: "granted"; monthLabel: string; dropPercent: number; days: number; until: Date; remaining: number }
  | { kind: "revoked"; monthLabel: string; days: number; until: Date; reason: string };

export async function notifyOwnersOfRelief(storeId: string, notice: ReliefNotice) {
  await sendToOwners(storeId, (ownerName, storeName, url) => reliefText(ownerName, storeName, notice, url));
}

export function reliefText(ownerName: string, storeName: string, notice: ReliefNotice, url: string) {
  const lines =
    notice.kind === "granted"
      ? [
          `Halo ${ownerName}, omzet toko ${storeName} bulan ${notice.monthLabel} turun ${notice.dropPercent}% dibanding rata-rata 3 bulan sebelumnya.`,
          `Sebagai Perlindungan bulan sepi, masa aktif ${PRODUCT_NAME} ditambah ${notice.days} hari menjadi sampai ${formatDate(notice.until)}.`,
          notice.remaining > 0
            ? `Sisa jatah perlindungan paket ini: ${notice.remaining} kali.`
            : "Jatah perlindungan paket ini sudah terpakai semua.",
        ]
      : [
          `Halo ${ownerName}, tambahan ${notice.days} hari Perlindungan bulan sepi (${notice.monthLabel}) untuk toko ${storeName} dibatalkan admin.`,
          `Alasan: ${notice.reason}. Masa aktif kini sampai ${formatDate(notice.until)}.`,
        ];
  return [...lines, "", url].join("\n");
}

// Kirim ke semua Pemilik aktif toko yang punya nomor WhatsApp.
async function sendToOwners(storeId: string, text: (ownerName: string, storeName: string, url: string) => string) {
  const [store] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return;

  const owners = await db
    .select({ fullName: users.fullName, phone: users.phone })
    .from(users)
    .where(and(eq(users.storeId, storeId), eq(users.role, "OWNER"), eq(users.isActive, true), isNotNull(users.phone)));

  const url = new URL("/subscription", env.NEXT_PUBLIC_APP_URL).toString();
  for (const owner of owners) {
    if (!owner.phone) continue;
    await sendWhatsApp({ to: owner.phone, text: text(owner.fullName, store.name, url) });
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
