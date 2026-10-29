// Server Action fitur langganan (BUSINESS-FLOW §14).
//
// - Pemilik (subscription:view): memilih paket → tagihan PENDING; membatalkan
//   tagihan PENDING tokonya. Boleh dijalankan saat toko terkunci (§14.3),
//   karena justru dari sinilah Pemilik memperpanjang.
// - Superadmin (subscription:manage): tandai lunas, batalkan; mengatur harga
//   paket & harga khusus (settings:manage). Tidak ada langganan gratis/bonus:
//   semua toko baru sudah mendapat masa gratis dari Pengaturan (§14.1).
//
// Perpanjangan dihitung di dalam transaksi dengan baris toko dikunci
// (SELECT ... FOR UPDATE), supaya dua konfirmasi bersamaan tidak saling
// menimpa subscription_until.

"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { stores, storePlanPrices, subscriptionPlans, subscriptions } from "@/lib/db/schema";
import { nextPeriod } from "@/lib/subscription-access";
import type { ActionResult } from "@/types/action-result";
import { PLAN_MONTHS } from "./constants";
import { listPlansForStore } from "./queries";
import {
  adminSubscriptionSchema,
  confirmPaymentSchema,
  planPricesSchema,
  requestSubscriptionSchema,
  storePlanPricesSchema,
  subscriptionIdSchema,
} from "./schemas";

const FORBIDDEN = { success: false, message: "Anda tidak memiliki akses." } as const;
const NOT_FOUND = { success: false, message: "Tagihan tidak ditemukan." } as const;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Pemilik
// ---------------------------------------------------------------------------

// Dipanggil dari <form action> kartu paket (hidden input months).
export async function requestSubscription(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await verifySession({ allowLocked: true });
  if (!can(actor, "subscription:view") || !actor.activeStore) return FORBIDDEN;

  const parsed = requestSubscriptionSchema.safeParse({ months: formData.get("months") });
  if (!parsed.success) return { success: false, message: "Pilih paket terlebih dahulu." };

  const storeId = actor.activeStore.id;
  const plan = (await listPlansForStore(storeId)).find((p) => p.months === parsed.data.months);
  if (!plan || plan.price <= 0) {
    return { success: false, message: "Harga paket ini belum diatur. Hubungi admin SakuDagang." };
  }

  // Maksimal satu tagihan menunggu per toko.
  const [pending] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.storeId, storeId), eq(subscriptions.status, "PENDING")))
    .limit(1);
  if (pending) return { success: false, message: "Masih ada tagihan yang menunggu pembayaran." };

  await db.insert(subscriptions).values({
    storeId,
    months: plan.months,
    price: plan.price, // snapshot
    status: "PENDING",
    createdById: actor.id,
  });

  revalidateSubscriptionPages();
  return { success: true, data: undefined };
}

// Pemilik membatalkan tagihan PENDING tokonya; Superadmin tagihan mana pun.
export async function cancelSubscription(subscriptionId: string): Promise<ActionResult> {
  const actor = await verifySession({ allowLocked: true });
  const id = subscriptionIdSchema.safeParse(subscriptionId);
  if (!id.success) return NOT_FOUND;

  const platformAdmin = can(actor, "subscription:manage");
  if (!platformAdmin && !(can(actor, "subscription:view") && actor.activeStore)) return FORBIDDEN;

  const [row] = await db
    .update(subscriptions)
    .set({ status: "CANCELLED" })
    .where(
      and(
        eq(subscriptions.id, id.data),
        eq(subscriptions.status, "PENDING"),
        platformAdmin ? undefined : eq(subscriptions.storeId, actor.activeStore!.id),
      ),
    )
    .returning({ id: subscriptions.id });
  if (!row) return NOT_FOUND;

  revalidateSubscriptionPages();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Superadmin
// ---------------------------------------------------------------------------

// Tandai tagihan PENDING lunas → periode terisi, masa toko diperpanjang.
export async function confirmSubscriptionPaid(subscriptionId: string, note?: string): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "subscription:manage")) return FORBIDDEN;

  const parsed = confirmPaymentSchema.safeParse({ subscriptionId, note: note ?? "" });
  if (!parsed.success) return NOT_FOUND;

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: subscriptions.id, storeId: subscriptions.storeId, months: subscriptions.months })
      .from(subscriptions)
      .where(and(eq(subscriptions.id, parsed.data.subscriptionId), eq(subscriptions.status, "PENDING")))
      .for("update");
    if (!row) return null;

    const period = await extendStore(tx, row.storeId, row.months);
    if (!period) return null;
    await tx
      .update(subscriptions)
      .set({
        status: "ACTIVE",
        startsAt: period.startsAt,
        endsAt: period.endsAt,
        paidAt: new Date(),
        note: parsed.data.note,
        confirmedById: actor.id,
      })
      .where(eq(subscriptions.id, row.id));
    return period;
  });
  if (!result) return NOT_FOUND;

  revalidateSubscriptionPages();
  return { success: true, data: undefined };
}

// Superadmin membuat tagihan untuk sebuah toko (pembayaran langsung saat
// kunjungan / permintaan pemilik). Harga = harga yang berlaku untuk toko itu.
// Bila `paid`, langsung lunas dan masa aktif diperpanjang dalam transaksi yang sama.
export async function createSubscriptionForStore(
  _prevState: ActionResult<{ paid: boolean }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ paid: boolean }>> {
  const actor = await verifySession();
  if (!can(actor, "subscription:manage")) return FORBIDDEN;

  const parsed = adminSubscriptionSchema.safeParse({
    storeId: formData.get("storeId"),
    months: formData.get("months"),
    note: formData.get("note") ?? "",
    paid: formData.get("paid") === "1",
  });
  if (!parsed.success) return invalid(parsed.error);
  const { storeId, months, note, paid } = parsed.data;

  const plan = (await listPlansForStore(storeId)).find((p) => p.months === months);
  if (!plan || plan.price <= 0) return { success: false, message: "Harga paket ini belum diatur." };

  const [pending] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.storeId, storeId), eq(subscriptions.status, "PENDING")))
    .limit(1);
  if (pending) return { success: false, message: "Masih ada tagihan yang menunggu pembayaran untuk toko ini." };

  const created = await db.transaction(async (tx) => {
    const period = paid ? await extendStore(tx, storeId, months) : null;
    if (paid && !period) return false;
    const now = new Date();
    await tx.insert(subscriptions).values({
      storeId,
      months,
      price: plan.price,
      status: paid ? "ACTIVE" : "PENDING",
      startsAt: period?.startsAt ?? null,
      endsAt: period?.endsAt ?? null,
      paidAt: paid ? now : null,
      note,
      createdById: actor.id,
      confirmedById: paid ? actor.id : null,
    });
    return true;
  });
  if (!created) return { success: false, message: "Toko tidak ditemukan." };

  revalidateSubscriptionPages();
  return { success: true, data: { paid } };
}

// Kunci baris toko, hitung periode baru dari subscription_until yang sedang
// berjalan, lalu simpan. Mengembalikan periode, atau null bila toko tidak ada.
async function extendStore(tx: Transaction, storeId: string, months: number) {
  const [store] = await tx
    .select({ subscriptionUntil: stores.subscriptionUntil })
    .from(stores)
    .where(eq(stores.id, storeId))
    .for("update");
  if (!store) return null;

  const period = nextPeriod(store.subscriptionUntil, months);
  await tx.update(stores).set({ subscriptionUntil: period.endsAt }).where(eq(stores.id, storeId));
  return period;
}

// ---------------------------------------------------------------------------
// Pengaturan harga (settings:manage)
// ---------------------------------------------------------------------------

export async function updatePlanPrices(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "settings:manage")) return FORBIDDEN;

  const parsed = planPricesSchema.safeParse({
    price1: formData.get("price1"),
    price6: formData.get("price6"),
    price12: formData.get("price12"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const prices = { 1: parsed.data.price1, 6: parsed.data.price6, 12: parsed.data.price12 } as const;
  await db.transaction(async (tx) => {
    for (const months of PLAN_MONTHS) {
      await tx
        .insert(subscriptionPlans)
        .values({ months, price: prices[months] })
        .onConflictDoUpdate({ target: subscriptionPlans.months, set: { price: prices[months] } });
    }
  });

  revalidateSubscriptionPages();
  return { success: true, data: undefined };
}

// Harga khusus satu toko. Nominal kosong = hapus harga khusus periode itu.
export async function saveStorePlanPrices(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "settings:manage")) return FORBIDDEN;

  const parsed = storePlanPricesSchema.safeParse({
    storeId: formData.get("storeId"),
    price1: formData.get("price1") ?? "",
    price6: formData.get("price6") ?? "",
    price12: formData.get("price12") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error);

  const { storeId, note } = parsed.data;
  const prices = { 1: parsed.data.price1, 6: parsed.data.price6, 12: parsed.data.price12 } as const;

  await db.transaction(async (tx) => {
    for (const months of PLAN_MONTHS) {
      const price = prices[months];
      if (price == null) {
        await tx.delete(storePlanPrices).where(and(eq(storePlanPrices.storeId, storeId), eq(storePlanPrices.months, months)));
      } else {
        await tx
          .insert(storePlanPrices)
          .values({ storeId, months, price, note })
          .onConflictDoUpdate({ target: [storePlanPrices.storeId, storePlanPrices.months], set: { price, note } });
      }
    }
  });

  revalidateSubscriptionPages();
  return { success: true, data: undefined };
}

function invalid(error: z.ZodError) {
  return {
    success: false as const,
    message: "Periksa kembali isian Anda.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

// Halaman yang menampilkan status/tagihan: Langganan (toko), Tagihan &
// Pengaturan (platform), beranda & detail toko (kartu status), dan layout
// (spanduk pengingat + data user yang di-cache).
function revalidateSubscriptionPages() {
  revalidatePath("/", "layout");
}
