// Server Action penjualan / kasir (docs/BUSINESS-FLOW.md §5).
//
// - Simpan penjualan = satu db.transaction(): nomor JL-, dokumen, baris
//   (snapshot harga jual & harga modal), dan mutasi stok SALE −qty.
//   Stok minus DIPERBOLEHKAN (barang fisik yang belum tercatat).
// - Tanggal transaksi selalu "hari ini" menurut zona waktu toko, bukan input.
// - Kasir tidak boleh menjual di bawah harga modal; Pemilik boleh. Pesan
//   untuk Kasir tidak menyebut harga modalnya.
// - Penjualan tidak bisa diedit; salah input = batalkan (VOIDED) dengan
//   alasan, mutasi SALE_VOID +qty. Kasir hanya miliknya di hari yang sama.
//   Bon yang sudah ada pelunasannya ditolak sampai pelunasannya dibatalkan.
// - Baris barang dikunci (FOR UPDATE) urut id agar dua kasir yang menjual
//   barang yang sama bersamaan tidak saling menimpa stok (lihat lib/stock.ts).

"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStore } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { zonedDateString } from "@/lib/dates";
import { db } from "@/lib/db";
import { creditPayments, customers, products, saleItems, sales } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/document-number";
import { recordStockMovement } from "@/lib/stock";
import type { ActionResult } from "@/types/action-result";
import { saleSchema, voidSaleSchema, type SaleInput } from "./schemas";
import { calculateSaleLine, calculateSaleTotals, canVoidSale, isPriceAllowed } from "./service";

// Pelanggaran aturan bisnis di tengah transaksi: dilempar agar transaksi
// di-rollback, lalu diubah menjadi pesan untuk user.
class SaleRuleError extends Error {}

export type SaleSaved = { id: string; number: string; total: number; change: number | null };

// Dipanggil dari layar kasir (event handler); argumen divalidasi ulang dengan zod.
export async function createSale(input: SaleInput): Promise<ActionResult<SaleSaved>> {
  const actor = await requireStore("sale:create");

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Periksa kembali transaksi." };
  }
  const { paymentMethod, items } = parsed.data;
  const customerId = paymentMethod === "CREDIT" ? parsed.data.customerId : null;
  const cashReceived = paymentMethod === "CASH" ? parsed.data.cashReceived : null;
  const canSellBelowCost = can(actor, "product:view-cost");

  try {
    const saved = await db.transaction(async (tx) => {
      if (customerId) {
        const [customer] = await tx
          .select({ name: customers.name, allowCredit: customers.allowCredit })
          .from(customers)
          .where(and(eq(customers.id, customerId), eq(customers.storeId, actor.storeId)))
          .limit(1);
        if (!customer) throw new SaleRuleError("Pelanggan tidak ditemukan. Muat ulang halaman.");
        if (!customer.allowCredit) throw new SaleRuleError(`${customer.name} ditandai tidak boleh bon.`);
      }

      const locked = await tx
        .select({
          id: products.id,
          name: products.name,
          costPrice: products.costPrice,
          isActive: products.isActive,
        })
        .from(products)
        .where(
          and(eq(products.storeId, actor.storeId), inArray(products.id, items.map((item) => item.productId))),
        )
        .orderBy(asc(products.id))
        .for("update");
      const byId = new Map(locked.map((product) => [product.id, product]));

      const lines = items.map((item) => {
        const product = byId.get(item.productId);
        // Barang toko lain (id ditebak) = tidak ditemukan.
        if (!product) throw new SaleRuleError("Ada barang yang tidak ditemukan. Muat ulang halaman kasir.");
        if (!product.isActive) throw new SaleRuleError(`${product.name} sudah nonaktif dan tidak bisa dijual.`);
        if (!isPriceAllowed(item.sellingPrice, product.costPrice, canSellBelowCost)) {
          throw new SaleRuleError(`Harga ${product.name} terlalu rendah. Minta pemilik toko bila perlu harga khusus.`);
        }
        return { ...item, productName: product.name, costPrice: product.costPrice };
      });

      const totals = calculateSaleTotals(lines);
      // Dicek ulang di sini karena total final dihitung server.
      if (cashReceived !== null && cashReceived < totals.total) {
        throw new SaleRuleError("Uang diterima kurang dari total.");
      }

      const date = zonedDateString(new Date());
      const [year, month] = date.split("-").map(Number);
      const number = await nextDocumentNumber(tx, { storeId: actor.storeId, prefix: "JL", year, month });

      const [sale] = await tx
        .insert(sales)
        .values({
          storeId: actor.storeId,
          number,
          periodYear: year,
          periodMonth: month,
          date,
          paymentMethod,
          customerId,
          ...totals,
          cashReceived,
          paymentStatus: paymentMethod === "CREDIT" ? "UNPAID" : "PAID",
          createdById: actor.id,
        })
        .returning({ id: sales.id });

      await tx.insert(saleItems).values(
        lines.map((line) => ({
          storeId: actor.storeId,
          saleId: sale.id,
          productId: line.productId,
          productName: line.productName,
          qty: line.qty,
          sellingPrice: line.sellingPrice,
          costPrice: line.costPrice,
          ...calculateSaleLine(line.qty, line.sellingPrice, line.costPrice),
        })),
      );

      for (const line of [...lines].sort((a, b) => a.productId.localeCompare(b.productId))) {
        await recordStockMovement(tx, {
          storeId: actor.storeId,
          productId: line.productId,
          type: "SALE",
          qty: -line.qty,
          referenceTable: "sales",
          referenceId: sale.id,
          note: number,
          createdById: actor.id,
        });
      }

      return {
        id: sale.id,
        number,
        total: totals.total,
        change: cashReceived === null ? null : cashReceived - totals.total,
      };
    });

    revalidateSales();
    return { success: true, data: saved };
  } catch (error) {
    if (error instanceof SaleRuleError) return { success: false, message: error.message };
    throw error;
  }
}

// Dipanggil dari dialog pembatalan; argumen divalidasi ulang dengan zod.
export async function voidSale(saleId: string, reason: string): Promise<ActionResult> {
  const actor = await requireStore("sale:void-own");

  const parsed = voidSaleSchema.safeParse({ saleId, reason });
  if (!parsed.success) {
    return {
      success: false,
      message: z.flattenError(parsed.error).fieldErrors.reason?.[0] ?? "Penjualan tidak ditemukan.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      // Baris penjualan dikunci agar dua pembatalan bersamaan tidak diproses dua kali.
      const [sale] = await tx
        .select({ id: sales.id, number: sales.number, date: sales.date, status: sales.status, createdById: sales.createdById })
        .from(sales)
        .where(and(eq(sales.id, parsed.data.saleId), eq(sales.storeId, actor.storeId)))
        .for("update");
      if (!sale) throw new SaleRuleError("Penjualan tidak ditemukan.");
      if (sale.status !== "COMPLETED") throw new SaleRuleError("Penjualan ini sudah dibatalkan.");

      const allowed = canVoidSale({
        canVoidAll: can(actor, "sale:void-all"),
        actorId: actor.id,
        today: zonedDateString(new Date()),
        sale,
      });
      if (!allowed) {
        throw new SaleRuleError("Kasir hanya bisa membatalkan transaksinya sendiri pada hari yang sama.");
      }
      // Bon yang sudah ada pelunasannya tidak boleh dibatalkan (BUSINESS-FLOW
      // §5.4): uangnya sudah diterima dan tercatat sebagai uang masuk.
      const [payment] = await tx
        .select({ id: creditPayments.id })
        .from(creditPayments)
        .where(and(eq(creditPayments.saleId, sale.id), eq(creditPayments.status, "COMPLETED")))
        .limit(1);
      if (payment) throw new SaleRuleError("Bon ini sudah ada pelunasannya. Batalkan pelunasannya dulu.");

      await tx
        .update(sales)
        .set({ status: "VOIDED", voidReason: parsed.data.reason, voidedById: actor.id, voidedAt: new Date() })
        .where(eq(sales.id, sale.id));

      const items = await tx
        .select({ productId: saleItems.productId, qty: saleItems.qty })
        .from(saleItems)
        .where(eq(saleItems.saleId, sale.id))
        .orderBy(asc(saleItems.productId));
      for (const item of items) {
        await recordStockMovement(tx, {
          storeId: actor.storeId,
          productId: item.productId,
          type: "SALE_VOID",
          qty: item.qty,
          referenceTable: "sales",
          referenceId: sale.id,
          note: `${sale.number} dibatalkan`,
          createdById: actor.id,
        });
      }
    });
  } catch (error) {
    if (error instanceof SaleRuleError) return { success: false, message: error.message };
    throw error;
  }

  revalidateSales();
  return { success: true, data: undefined };
}

// Penjualan mengubah stok barang & ringkasan beranda.
function revalidateSales() {
  revalidatePath("/cashier");
  revalidatePath("/sales", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/");
}
