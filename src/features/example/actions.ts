// Mengubah data lewat Server Action. Server Action adalah endpoint publik:
// siapa pun bisa memanggilnya dengan data apa pun, jadi langkah 1–3 WAJIB:
//
//   1. validasi input (zod, schemas.ts)
//   2. verifySession() / requirePermission()  ← lib/auth/dal.ts
//   3. cek kepemilikan data
//   4. panggil service.ts untuk aturan bisnis
//   5. simpan ke DB (dalam satu transaksi bila lebih dari satu tabel)
//   6. revalidatePath() / redirect()
//   7. return ActionResult (types/action-result.ts)
//
// Contoh kerangka:
//
//   export async function createExample(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
//     const parsed = exampleSchema.safeParse({ name: formData.get("name") });
//     if (!parsed.success) {
//       return { success: false, message: "Periksa kembali isian Anda.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
//     }
//     const user = await requirePermission("example:manage");
//     ...
//   }

"use server";

export {};
