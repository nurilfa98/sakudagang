// Pengingat WhatsApp masa gratis/langganan (BUSINESS-FLOW §14.4): H-3 dan H-1
// sebelum `stores.subscription_until`, dikirim ke semua Pemilik aktif toko
// yang punya nomor WhatsApp. Dijalankan harian oleh
// app/api/cron/subscription-reminders/route.ts.
//
// Anti-dobel: `stores.last_reminder_key` menyimpan "<tanggal berakhir>:<H->"
// terakhir yang sudah dikirim; bila cron berjalan dua kali sehari, toko yang
// sama tidak dikirimi lagi. Setelah diperpanjang, tanggal berakhir berubah
// sehingga pengingat periode berikutnya tetap terkirim.

import "server-only";
import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatDate, zonedDateString } from "@/lib/dates";
import { db } from "@/lib/db";
import { stores, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { addDays } from "@/lib/subscription-access";
import { sendWhatsApp } from "@/lib/whatsapp";

export const REMINDER_OFFSETS = [3, 1] as const; // H-3, H-1

export type ReminderResult = { storeId: string; storeName: string; daysLeft: number; sent: number };

export async function sendSubscriptionReminders(now = new Date()): Promise<ReminderResult[]> {
  const maxOffset = Math.max(...REMINDER_OFFSETS);
  // Tanggal kalender (zona waktu aplikasi) → H- yang cocok hari ini.
  const targets = new Map(REMINDER_OFFSETS.map((offset) => [zonedDateString(addDays(now, offset)), offset]));

  const candidates = await db
    .select({
      id: stores.id,
      name: stores.name,
      subscriptionUntil: stores.subscriptionUntil,
      lastReminderKey: stores.lastReminderKey,
    })
    .from(stores)
    .where(
      and(
        eq(stores.isActive, true),
        gte(stores.subscriptionUntil, now),
        lte(stores.subscriptionUntil, addDays(now, maxOffset + 1)),
      ),
    );

  const due = candidates.flatMap((store) => {
    const untilDate = zonedDateString(store.subscriptionUntil);
    const offset = targets.get(untilDate);
    if (offset === undefined) return [];
    const key = `${untilDate}:${offset}`;
    return store.lastReminderKey === key ? [] : [{ ...store, offset, key }];
  });
  if (due.length === 0) return [];

  const owners = await db
    .select({ storeId: users.storeId, fullName: users.fullName, phone: users.phone })
    .from(users)
    .where(
      and(
        inArray(
          users.storeId,
          due.map((store) => store.id),
        ),
        eq(users.role, "OWNER"),
        eq(users.isActive, true),
        isNotNull(users.phone),
      ),
    );

  const results: ReminderResult[] = [];
  for (const store of due) {
    let sent = 0;
    for (const owner of owners.filter((o) => o.storeId === store.id && o.phone)) {
      const ok = await sendWhatsApp({
        to: owner.phone!,
        text: reminderText({ ownerName: owner.fullName, storeName: store.name, until: store.subscriptionUntil, daysLeft: store.offset }),
      });
      if (ok) sent += 1;
    }
    // Tandai sudah diproses walau tidak ada pemilik ber-WA, agar tidak dicoba terus.
    await db.update(stores).set({ lastReminderKey: store.key }).where(eq(stores.id, store.id));
    results.push({ storeId: store.id, storeName: store.name, daysLeft: store.offset, sent });
  }
  return results;
}

export function reminderText({
  ownerName,
  storeName,
  until,
  daysLeft,
}: {
  ownerName: string;
  storeName: string;
  until: Date;
  daysLeft: number;
}) {
  const url = new URL("/subscription", env.NEXT_PUBLIC_APP_URL).toString();
  return [
    `Halo ${ownerName}, masa aktif ${PRODUCT_NAME} untuk toko ${storeName} berakhir ${formatDate(until)} (${daysLeft} hari lagi).`,
    "",
    "Agar kasir dan laporan tetap bisa dipakai, pilih paket langganan dan lakukan pembayaran di menu Langganan:",
    url,
    "",
    "Perpanjangan dihitung dari tanggal berakhir, jadi membayar lebih awal tidak merugikan. Terima kasih.",
  ].join("\n");
}
