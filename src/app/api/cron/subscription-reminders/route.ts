// GET /api/cron/subscription-reminders: job harian langganan.
// 1. Penilaian perlindungan bulan sepi untuk bulan sebelumnya
//    (features/subscriptions/reliefs.ts, BUSINESS-FLOW §14.8). Dijalankan
//    lebih dulu agar pengingat memakai masa aktif yang sudah diperpanjang.
// 2. Pengingat WhatsApp H-3 dan H-1 masa gratis/langganan ke Pemilik toko
//    (features/subscriptions/reminders.ts).
// Dijadwalkan harian di vercel.json (atau cron hosting lain), diamankan
// dengan header `Authorization: Bearer <CRON_SECRET>` seperti /api/cron/example.
//
// Route ini dikecualikan dari cek login di proxy.ts (tidak ada cookie).

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { evaluateSlowMonthReliefs } from "@/features/subscriptions/reliefs";
import { sendSubscriptionReminders } from "@/features/subscriptions/reminders";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET belum diatur" }, { status: 503 });
  }
  if (!isAuthorized(request.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reliefs = await evaluateSlowMonthReliefs();
  const reminded = await sendSubscriptionReminders();
  return NextResponse.json({ ok: true, reliefs, reminded }, { headers: { "Cache-Control": "no-store" } });
}

function isAuthorized(header: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
