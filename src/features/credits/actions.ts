// Server Action pelanggan & bon (BUSINESS-FLOW §6).
//
// - Tambah pelanggan: customer:manage (Pemilik & Kasir, juga dari layar kasir).
// - Ubah pelanggan & tandai "tidak boleh bon": customer:edit (Pemilik).
// - Catat pelunasan: credit:settle (Pemilik & Kasir). Satu pelunasan untuk
//   satu penjualan bon, boleh sebagian, tidak melebihi sisa. Baris penjualan
//   dikunci (FOR UPDATE) agar dua pelunasan bersamaan tidak melebihi sisa.
// - Batalkan pelunasan: Pemilik kapan pun, Kasir hanya catatannya sendiri di
//   hari yang sama. Status bon kembali "belum lunas".

"use server";

import { and, eq, sum } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStore } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { zonedDateString } from "@/lib/dates";
import { db } from "@/lib/db";
import { creditPayments, customers, sales } from "@/lib/db/schema";
import type { ActionResult } from "@/types/action-result";
import type { CustomerOption } from "./queries";
import {
  creditPaymentSchema,
  customerSchema,
  updateCustomerSchema,
  voidCreditPaymentSchema,
  type CreditPaymentInput,
} from "./schemas";
import { canVoidCreditPayment, creditPaymentStatus, remainingCredit, validatePaymentAmount } from "./service";

// Pelanggaran aturan bisnis di tengah transaksi: dilempar agar transaksi
// di-rollback, lalu diubah menjadi pesan untuk user.
class CreditRuleError extends Error {}

const CUSTOMER_NOT_FOUND = { success: false, message: "Pelanggan tidak ditemukan." } as const;

const customerColumns = {
  id: customers.id,
  name: customers.name,
  phone: customers.phone,
  note: customers.note,
  allowCredit: customers.allowCredit,
};

// ---------------------------------------------------------------------------
// Pelanggan
// ---------------------------------------------------------------------------

// Dipanggil dari dialog "Pelanggan baru"; argumen divalidasi ulang dengan zod.
export async function createCustomer(input: {
  name: string;
  phone: string;
  note: string;
}): Promise<ActionResult<CustomerOption>> {
  const actor = await requireStore("customer:manage");

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const [created] = await db
    .insert(customers)
    .values({ ...parsed.data, storeId: actor.storeId })
    .returning(customerColumns);

  revalidateCredits();
  return { success: true, data: created };
}

export async function updateCustomer(input: {
  customerId: string;
  name: string;
  phone: string;
  note: string;
  allowCredit: boolean;
}): Promise<ActionResult> {
  const actor = await requireStore("customer:edit");

  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { customerId, ...data } = parsed.data;
  const [row] = await db
    .update(customers)
    .set(data)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, actor.storeId)))
    .returning({ id: customers.id });
  if (!row) return CUSTOMER_NOT_FOUND;

  revalidateCredits();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Pelunasan bon
// ---------------------------------------------------------------------------

export async function recordCreditPayment(input: CreditPaymentInput): Promise<ActionResult<{ remaining: number }>> {
  const actor = await requireStore("credit:settle");

  const parsed = creditPaymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { saleId, amount, paymentMethod, date } = parsed.data;

  if (date > zonedDateString(new Date())) {
    return fieldError("date", "Tanggal tidak boleh di masa depan");
  }

  try {
    const remaining = await db.transaction(async (tx) => {
      const [sale] = await tx
        .select({ id: sales.id, total: sales.total, date: sales.date, customerId: sales.customerId })
        .from(sales)
        .where(
          and(
            eq(sales.id, saleId),
            eq(sales.storeId, actor.storeId),
            eq(sales.paymentMethod, "CREDIT"),
            eq(sales.status, "COMPLETED"),
          ),
        )
        .for("update");
      if (!sale || !sale.customerId) throw new CreditRuleError("Bon tidak ditemukan atau sudah dibatalkan.");
      if (date < sale.date) throw new CreditRuleError("Tanggal pelunasan tidak boleh sebelum tanggal bon.");

      const paid = await paidAmount(tx, sale.id);
      const problem = validatePaymentAmount(amount, remainingCredit(sale.total, paid));
      if (problem) throw new CreditRuleError(problem);

      await tx.insert(creditPayments).values({
        storeId: actor.storeId,
        saleId: sale.id,
        customerId: sale.customerId,
        date,
        amount,
        paymentMethod,
        createdById: actor.id,
      });
      await tx
        .update(sales)
        .set({ paymentStatus: creditPaymentStatus(sale.total, paid + amount) })
        .where(eq(sales.id, sale.id));

      return remainingCredit(sale.total, paid + amount);
    });

    revalidateCredits();
    return { success: true, data: { remaining } };
  } catch (error) {
    if (error instanceof CreditRuleError) return { success: false, message: error.message };
    throw error;
  }
}

export async function voidCreditPayment(paymentId: string, reason: string): Promise<ActionResult> {
  const actor = await requireStore("credit:settle");

  const parsed = voidCreditPaymentSchema.safeParse({ paymentId, reason });
  if (!parsed.success) {
    return { success: false, message: z.flattenError(parsed.error).fieldErrors.reason?.[0] ?? "Pelunasan tidak ditemukan." };
  }

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select({
          id: creditPayments.id,
          saleId: creditPayments.saleId,
          status: creditPayments.status,
          createdById: creditPayments.createdById,
          createdAt: creditPayments.createdAt,
        })
        .from(creditPayments)
        .where(and(eq(creditPayments.id, parsed.data.paymentId), eq(creditPayments.storeId, actor.storeId)))
        .for("update");
      if (!payment) throw new CreditRuleError("Pelunasan tidak ditemukan.");
      if (payment.status !== "COMPLETED") throw new CreditRuleError("Pelunasan ini sudah dibatalkan.");

      const allowed = canVoidCreditPayment({
        canVoidAll: can(actor, "sale:void-all"),
        actorId: actor.id,
        today: zonedDateString(new Date()),
        payment: { createdById: payment.createdById, createdDate: zonedDateString(payment.createdAt) },
      });
      if (!allowed) throw new CreditRuleError("Kasir hanya bisa membatalkan pelunasan yang ia catat hari ini.");

      // Kunci penjualannya juga, urutan sama dengan recordCreditPayment.
      const [sale] = await tx.select({ total: sales.total }).from(sales).where(eq(sales.id, payment.saleId)).for("update");

      await tx
        .update(creditPayments)
        .set({ status: "VOIDED", voidReason: parsed.data.reason, voidedById: actor.id, voidedAt: new Date() })
        .where(eq(creditPayments.id, payment.id));
      await tx
        .update(sales)
        .set({ paymentStatus: creditPaymentStatus(sale.total, await paidAmount(tx, payment.saleId)) })
        .where(eq(sales.id, payment.saleId));
    });
  } catch (error) {
    if (error instanceof CreditRuleError) return { success: false, message: error.message };
    throw error;
  }

  revalidateCredits();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Helper (tanpa export → bukan Server Action)
// ---------------------------------------------------------------------------

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Σ pelunasan yang berlaku untuk satu penjualan.
async function paidAmount(tx: Transaction, saleId: string) {
  const [row] = await tx
    .select({ paid: sum(creditPayments.amount).mapWith(Number) })
    .from(creditPayments)
    .where(and(eq(creditPayments.saleId, saleId), eq(creditPayments.status, "COMPLETED")));
  return row?.paid ?? 0;
}

function invalid(error: z.ZodError) {
  return {
    success: false as const,
    message: "Periksa kembali isian Anda.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

function fieldError(field: string, message: string) {
  return { success: false as const, message: "Periksa kembali isian Anda.", fieldErrors: { [field]: [message] } };
}

// Pelanggan & bon tampil di layar kasir, halaman bon, riwayat penjualan, dan beranda.
function revalidateCredits() {
  revalidatePath("/credits", "layout");
  revalidatePath("/cashier");
  revalidatePath("/sales", "layout");
  revalidatePath("/");
}
