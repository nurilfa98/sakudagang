// Server Action fitur langganan (BUSINESS-FLOW §14).
//
// - Pemilik (subscription:view): memilih paket lalu "Saya sudah bayar" +
//   bukti → tagihan tercatat (CLAIMED) beserta pembayaran pertama; bila
//   tagihan kurang bayar, bukti berikutnya ditambahkan ke tagihan yang sama.
//   Memilih paket saja tidak menyimpan apa pun. Boleh dijalankan saat toko
//   terkunci (§14.3), karena justru dari sinilah Pemilik memperpanjang. Klaim
//   bayar TIDAK mengubah akses; hanya pembayaran yang diterima admin sampai
//   lunas yang memperpanjang masa toko.
// - Superadmin (subscription:manage): memeriksa tiap pembayaran → terima
//   (isi nominal masuk; lunas bila total ≥ harga, selain itu kurang bayar)
//   atau tolak (alasan wajib; bila belum ada yang diterima, tagihan ditolak
//   final). Mencatat pembayaran langsung; mengatur harga paket & harga khusus
//   (settings:manage). Tidak ada tombol batalkan dan tidak ada langganan
//   gratis/bonus: semua toko baru sudah mendapat masa gratis dari Pengaturan.
//
// Perpanjangan dihitung di dalam transaksi dengan baris toko dikunci
// (SELECT ... FOR UPDATE), supaya dua konfirmasi bersamaan tidak saling
// menimpa subscription_until.

"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  platformSettings,
  stores,
  storePlanPrices,
  subscriptionPayments,
  subscriptionPlans,
  subscriptions,
} from "@/lib/db/schema";
import { zonedYearMonth } from "@/lib/dates";
import { formatRupiah } from "@/lib/format";
import { getPlatformSettings, PLATFORM_SETTINGS_ID } from "@/lib/platform-settings";
import { deleteObject, putObject } from "@/lib/storage";
import { nextPeriod } from "@/lib/subscription-access";
import { sendWhatsApp } from "@/lib/whatsapp";
import type { ActionResult } from "@/types/action-result";
import { OPEN_SUBSCRIPTION_STATUSES, PLAN_LABELS, PLAN_MONTHS, PROOF_MAX_BYTES, PROOF_TYPES, type PlanMonths } from "./constants";
import { notifyOwnersOfPaymentOutcome } from "./notifications";
import { planPrice } from "./pricing";
import { listPlansForStore } from "./queries";
import {
  acceptPaymentSchema,
  adminSubscriptionSchema,
  claimPaymentSchema,
  planPricingSchema,
  rejectPaymentSchema,
  storePlanPricesSchema,
} from "./schemas";

const FORBIDDEN = { success: false, message: "Anda tidak memiliki akses." } as const;
const NOT_FOUND = { success: false, message: "Tagihan tidak ditemukan." } as const;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Pemilik: "Saya sudah bayar" (tagihan baru atau melengkapi kurang bayar)
// ---------------------------------------------------------------------------

export async function claimSubscriptionPaid(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await verifySession({ allowLocked: true });
  if (!can(actor, "subscription:view") || !actor.activeStore) return FORBIDDEN;

  const parsed = claimPaymentSchema.safeParse({
    months: formData.get("months") ?? undefined,
    subscriptionId: formData.get("subscriptionId") ?? undefined,
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { success: false, message: "Pilih paket terlebih dahulu." };

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Unggah bukti transfer (foto/screenshot atau PDF)." };
  }
  if (!(PROOF_TYPES as readonly string[]).includes(file.type)) {
    return { success: false, message: "Format bukti harus PNG, JPG, WebP, atau PDF." };
  }
  if (file.size > PROOF_MAX_BYTES) return { success: false, message: "Ukuran bukti maksimal 3 MB." };

  const storeId = actor.activeStore.id;
  const { note } = parsed.data;

  // Mode 1: melengkapi tagihan kurang bayar milik toko ini.
  // Mode 2: tagihan baru dari paket yang dipilih (harga dihitung di server).
  let subscriptionId: string;
  let months: PlanMonths;
  let price: number;
  let isNew = false;
  if (parsed.data.subscriptionId) {
    const [open] = await db
      .select({ id: subscriptions.id, months: subscriptions.months, price: subscriptions.price })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, parsed.data.subscriptionId),
          eq(subscriptions.storeId, storeId),
          eq(subscriptions.status, "UNDERPAID"),
        ),
      )
      .limit(1);
    if (!open) return { success: false, message: "Tagihan kurang bayar tidak ditemukan." };
    subscriptionId = open.id;
    months = open.months as PlanMonths;
    price = open.price;
  } else {
    if (parsed.data.months == null) return { success: false, message: "Pilih paket terlebih dahulu." };
    const plan = (await listPlansForStore(storeId)).find((p) => p.months === parsed.data.months);
    if (!plan || plan.price <= 0) {
      return { success: false, message: "Harga paket ini belum diatur. Hubungi admin SakuDagang." };
    }
    // Satu tagihan terbuka per toko.
    if (await hasOpenSubscription(storeId)) {
      return { success: false, message: "Masih ada tagihan yang belum selesai (menunggu konfirmasi / kurang bayar)." };
    }
    subscriptionId = crypto.randomUUID();
    months = plan.months;
    price = plan.price;
    isNew = true;
  }

  const paymentId = crypto.randomUUID();
  const key = proofKey(storeId, paymentId, file.type);
  await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);

  try {
    await db.transaction(async (tx) => {
      if (isNew) {
        await tx.insert(subscriptions).values({
          id: subscriptionId,
          storeId,
          months,
          price, // snapshot
          status: "CLAIMED",
          createdById: actor.id,
        });
      } else {
        // Kurang bayar → ada pembayaran baru yang menunggu konfirmasi.
        await tx.update(subscriptions).set({ status: "CLAIMED" }).where(eq(subscriptions.id, subscriptionId));
      }
      await tx.insert(subscriptionPayments).values({
        id: paymentId,
        subscriptionId,
        storeId,
        status: "PENDING",
        proofKey: key,
        note,
        createdById: actor.id,
      });
    });
  } catch (error) {
    await deleteObject(key).catch(() => undefined);
    throw error;
  }

  // Beri tahu admin; gagal kirim tidak membatalkan klaim.
  const settings = await getPlatformSettings();
  if (settings.adminPhone) {
    await sendWhatsApp({
      to: settings.adminPhone,
      text: [
        `${isNew ? "Klaim pembayaran langganan" : "Bukti pelunasan kurang bayar"} dari toko ${actor.activeStore.name} (${actor.fullName}).`,
        `Paket ${PLAN_LABELS[months]}, tagihan ${formatRupiah(price)}.`,
        note ? `Catatan: ${note}` : null,
        "Cek mutasi rekening lalu terima/tolak di menu Tagihan.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  revalidateSubscriptionPages();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Superadmin: memeriksa pembayaran
// ---------------------------------------------------------------------------

// Terima pembayaran dengan nominal yang benar-benar masuk. Total diterima
// ≥ harga → tagihan lunas, masa toko diperpanjang; kurang → UNDERPAID
// (pemilik melengkapi pada tagihan yang sama).
export async function acceptPayment(
  paymentId: string,
  amountReceived: string,
  note?: string,
): Promise<ActionResult<{ remaining: number }>> {
  const actor = await verifySession();
  if (!can(actor, "subscription:manage")) return FORBIDDEN;

  const parsed = acceptPaymentSchema.safeParse({ paymentId, amountReceived, note: note ?? "" });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Periksa kembali isian Anda." };
  }

  const result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .select({ id: subscriptionPayments.id, subscriptionId: subscriptionPayments.subscriptionId })
      .from(subscriptionPayments)
      .where(and(eq(subscriptionPayments.id, parsed.data.paymentId), eq(subscriptionPayments.status, "PENDING")))
      .for("update");
    if (!payment) return null;

    const [invoice] = await tx
      .select({
        id: subscriptions.id,
        storeId: subscriptions.storeId,
        months: subscriptions.months,
        price: subscriptions.price,
        amountPaid: subscriptions.amountPaid,
      })
      .from(subscriptions)
      .where(and(eq(subscriptions.id, payment.subscriptionId), inArray(subscriptions.status, [...OPEN_SUBSCRIPTION_STATUSES])))
      .for("update");
    if (!invoice) return null;

    const now = new Date();
    await tx
      .update(subscriptionPayments)
      .set({
        status: "ACCEPTED",
        amountReceived: parsed.data.amountReceived,
        reviewNote: parsed.data.note,
        reviewedAt: now,
        reviewedById: actor.id,
      })
      .where(eq(subscriptionPayments.id, payment.id));

    const amountPaid = invoice.amountPaid + parsed.data.amountReceived;
    if (amountPaid >= invoice.price) {
      const period = await extendStore(tx, invoice.storeId, invoice.months);
      if (!period) return null;
      await tx
        .update(subscriptions)
        .set({
          status: "ACTIVE",
          amountPaid,
          startsAt: period.startsAt,
          endsAt: period.endsAt,
          paidAt: now,
          confirmedById: actor.id,
        })
        .where(eq(subscriptions.id, invoice.id));
      return { storeId: invoice.storeId, remaining: 0, until: period.endsAt, price: invoice.price };
    }

    await tx.update(subscriptions).set({ status: "UNDERPAID", amountPaid }).where(eq(subscriptions.id, invoice.id));
    return { storeId: invoice.storeId, remaining: invoice.price - amountPaid, until: null, price: invoice.price };
  });
  if (!result) return NOT_FOUND;

  // Kabari pemilik (lunas / kurang bayar); gagal kirim tidak membatalkan keputusan.
  await notifyOwnersOfPaymentOutcome(
    result.storeId,
    result.until
      ? { kind: "paid", until: result.until }
      : { kind: "underpaid", received: parsed.data.amountReceived, remaining: result.remaining, price: result.price },
  );

  revalidateSubscriptionPages();
  return { success: true, data: { remaining: result.remaining } };
}

// Tolak satu pembayaran (dana tidak masuk / bukti palsu). Bila tagihan belum
// pernah menerima pembayaran → tagihan ditolak final (REJECTED, pemilik mulai
// lagi dari pilihan paket); bila sudah ada yang diterima → kembali UNDERPAID.
export async function rejectPayment(paymentId: string, reason: string): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "subscription:manage")) return FORBIDDEN;

  const parsed = rejectPaymentSchema.safeParse({ paymentId, reason });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Periksa kembali isian Anda." };
  }

  const done = await db.transaction(async (tx) => {
    const [payment] = await tx
      .select({ id: subscriptionPayments.id, subscriptionId: subscriptionPayments.subscriptionId })
      .from(subscriptionPayments)
      .where(and(eq(subscriptionPayments.id, parsed.data.paymentId), eq(subscriptionPayments.status, "PENDING")))
      .for("update");
    if (!payment) return null;

    const [invoice] = await tx
      .select({ id: subscriptions.id, storeId: subscriptions.storeId, amountPaid: subscriptions.amountPaid })
      .from(subscriptions)
      .where(eq(subscriptions.id, payment.subscriptionId))
      .for("update");
    if (!invoice) return null;

    const now = new Date();
    await tx
      .update(subscriptionPayments)
      .set({ status: "REJECTED", reviewNote: parsed.data.reason, reviewedAt: now, reviewedById: actor.id })
      .where(eq(subscriptionPayments.id, payment.id));

    if (invoice.amountPaid > 0) {
      await tx.update(subscriptions).set({ status: "UNDERPAID" }).where(eq(subscriptions.id, invoice.id));
    } else {
      await tx
        .update(subscriptions)
        .set({ status: "REJECTED", rejectedAt: now, rejectionNote: parsed.data.reason })
        .where(eq(subscriptions.id, invoice.id));
    }
    return invoice.storeId;
  });
  if (!done) return NOT_FOUND;

  // Kabari pemilik beserta alasannya; gagal kirim tidak membatalkan keputusan.
  await notifyOwnersOfPaymentOutcome(done, { kind: "rejected", reason: parsed.data.reason });

  revalidateSubscriptionPages();
  return { success: true, data: undefined };
}

// Superadmin mencatat pembayaran langsung untuk sebuah toko (tunai/transfer
// saat kunjungan). Harga = harga yang berlaku untuk toko itu; langsung lunas
// (tagihan + satu pembayaran diterima) dan masa aktif diperpanjang.
export async function createSubscriptionForStore(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "subscription:manage")) return FORBIDDEN;

  const parsed = adminSubscriptionSchema.safeParse({
    storeId: formData.get("storeId"),
    months: formData.get("months"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error);
  const { storeId, months, note } = parsed.data;

  const plan = (await listPlansForStore(storeId)).find((p) => p.months === months);
  if (!plan || plan.price <= 0) return { success: false, message: "Harga paket ini belum diatur." };

  if (await hasOpenSubscription(storeId)) {
    return { success: false, message: "Masih ada tagihan toko ini yang belum selesai (menunggu konfirmasi / kurang bayar)." };
  }

  const created = await db.transaction(async (tx) => {
    const period = await extendStore(tx, storeId, months);
    if (!period) return false;
    const now = new Date();
    const subscriptionId = crypto.randomUUID();
    await tx.insert(subscriptions).values({
      id: subscriptionId,
      storeId,
      months,
      price: plan.price,
      amountPaid: plan.price,
      status: "ACTIVE",
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      paidAt: now,
      note,
      createdById: actor.id,
      confirmedById: actor.id,
    });
    await tx.insert(subscriptionPayments).values({
      subscriptionId,
      storeId,
      status: "ACCEPTED",
      amountReceived: plan.price,
      reviewNote: note,
      reviewedAt: now,
      reviewedById: actor.id,
      createdById: actor.id,
    });
    return true;
  });
  if (!created) return { success: false, message: "Toko tidak ditemukan." };

  revalidateSubscriptionPages();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Pembantu
// ---------------------------------------------------------------------------

async function hasOpenSubscription(storeId: string) {
  const [open] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.storeId, storeId), inArray(subscriptions.status, [...OPEN_SUBSCRIPTION_STATUSES])))
    .limit(1);
  return open != null;
}

// Nama berkas bukti: awalan "YYYY-MM/" = folder per bulan di bucket (R2
// membuat "folder" dari awalan nama file), agar bukti transaksi lama mudah
// dibersihkan manual per bulan dari dashboard Cloudflare.
function proofKey(storeId: string, paymentId: string, mimeType: string) {
  const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const { year, month } = zonedYearMonth(new Date());
  const folder = `${year}-${String(month).padStart(2, "0")}`;
  return `${folder}/bukti-transfer/${storeId}/${paymentId}.${extension}`;
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

  const parsed = planPricingSchema.safeParse({
    monthlyPrice: formData.get("monthlyPrice") ?? "",
    discount6: formData.get("discount6") ?? "",
    discount12: formData.get("discount12") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error);

  // Harga 6 bulan & 1 tahun dihitung di server dari harga per bulan + diskon
  // (pricing.ts), lalu disimpan per periode agar tagihan, kartu paket, dan
  // harga khusus toko tetap membaca subscription_plans seperti biasa.
  const { discount6, discount12 } = parsed.data;
  await db.transaction(async (tx) => {
    for (const months of PLAN_MONTHS) {
      const price = planPrice(parsed.data, months);
      await tx
        .insert(subscriptionPlans)
        .values({ months, price })
        .onConflictDoUpdate({ target: subscriptionPlans.months, set: { price } });
    }
    await tx
      .insert(platformSettings)
      .values({ id: PLATFORM_SETTINGS_ID, discount6, discount12 })
      .onConflictDoUpdate({ target: platformSettings.id, set: { discount6, discount12 } });
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
