// Nomor dokumen berjalan per toko per bulan: BL-2026-10-0001 (pembelian),
// JL-… (penjualan), SO-… (stok opname). Dipakai beberapa fitur, karena itu
// letaknya di lib/.
//
// Nomor diambil dengan satu perintah INSERT … ON CONFLICT DO UPDATE …
// RETURNING di dalam transaksi yang sama dengan dokumennya. PostgreSQL
// mengunci baris urutan sampai transaksi selesai, sehingga dua kasir yang
// menyimpan bersamaan tidak mendapat nomor kembar; bila transaksi batal,
// nomornya ikut batal (tidak ada nomor yang terlewat).
//
// Referensi: https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT

import "server-only";
import { sql } from "drizzle-orm";
import type { db } from "@/lib/db";
import { documentSequences } from "@/lib/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DocumentPrefix = "BL" | "JL" | "SO";

export async function nextDocumentNumber(
  tx: Transaction,
  { storeId, prefix, year, month }: { storeId: string; prefix: DocumentPrefix; year: number; month: number },
) {
  const [row] = await tx
    .insert(documentSequences)
    .values({ storeId, prefix, periodYear: year, periodMonth: month, lastValue: 1 })
    .onConflictDoUpdate({
      target: [documentSequences.storeId, documentSequences.prefix, documentSequences.periodYear, documentSequences.periodMonth],
      set: { lastValue: sql`${documentSequences.lastValue} + 1` },
    })
    .returning({ value: documentSequences.lastValue });

  return formatDocumentNumber(prefix, year, month, row.value);
}

// BL, 2026, 10, 1 → "BL-2026-10-0001". Lewat 9999 per bulan angkanya memanjang.
export function formatDocumentNumber(prefix: DocumentPrefix, year: number, month: number, value: number) {
  return `${prefix}-${year}-${String(month).padStart(2, "0")}-${String(value).padStart(4, "0")}`;
}
