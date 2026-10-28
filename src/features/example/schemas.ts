// Skema zod: validasi input form. Dipakai di client (pesan error cepat) DAN di
// server (actions.ts), karena data dari client tidak boleh dipercaya.
//
//   import { z } from "zod";
//
//   export const exampleSchema = z.object({
//     name: z.string().trim().min(1, "Nama wajib diisi").max(100),
//   });
//
// Nominal rupiah dari form: server membuang semua karakter selain angka sebelum
// validasi (lihat bagian "Uang" di docs/ARCHITECTURE.md).

export {};
