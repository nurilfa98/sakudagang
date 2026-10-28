// Helper ekspor data ke file Excel (.xlsx) lewat route handler.
//
// Kenapa .xlsx, bukan CSV? Excel membaca CSV memakai "List separator" di
// pengaturan Region Windows masing-masing laptop (bisa koma, titik koma, atau
// titik). Bila tidak cocok, isi kolom tercampur. File .xlsx sudah menyimpan
// kolomnya sendiri, jadi selalu rapi di laptop mana pun.
// - Angka disimpan sebagai angka (type: Number) agar bisa dijumlahkan.
// - Teks disimpan sebagai teks biasa, bukan rumus, jadi aman dari injeksi
//   rumus (= + - @).
//
// Contoh pemakaian di app/api/<fitur>/export/route.ts (cek getCurrentUser() +
// can() lebih dulu, lalu ambil data dari features/<fitur>/queries.ts):
//
//   return xlsxResponse({
//     filename: `produk-${zonedDateString(new Date())}.xlsx`,
//     sheet: "Produk",
//     columns: [{ header: "Nama", width: 28 }, { header: "Harga (Rp)", width: 16 }],
//     rows: products.map((p) => [
//       { value: p.name, type: String },
//       { value: p.price, type: Number, format: "#,##0" },
//     ]),
//   });
//
// Referensi:
// - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
// - node_modules/write-excel-file/README.md

import "server-only";
import { NextResponse } from "next/server";
import writeXlsxFile, { type Row } from "write-excel-file/node";

type XlsxColumn = { header: string; width: number };

export async function xlsxResponse({
  filename,
  sheet,
  columns,
  rows,
}: {
  filename: string;
  sheet: string;
  columns: XlsxColumn[];
  rows: Row[];
}) {
  const header: Row = columns.map((column) => ({ value: column.header, fontWeight: "bold" as const }));

  const file = await writeXlsxFile([header, ...rows], {
    sheet,
    columns: columns.map((column) => ({ width: column.width })),
    stickyRowsCount: 1,
  }).toBuffer();

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
