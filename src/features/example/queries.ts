// Membaca data (server-only), dipanggil dari page.tsx (Server Component).
// Alurnya: cek session → query DB → kembalikan DTO (hanya field yang dibutuhkan UI).
//
//   import { requirePermission } from "@/lib/auth/dal";
//   import { db } from "@/lib/db";
//
//   export async function listExamples() {
//     await requirePermission("example:view");
//     const rows = await db.query.examples.findMany();
//     return rows.map((r) => ({ id: r.id, name: r.name })); // DTO
//   }

import "server-only";
