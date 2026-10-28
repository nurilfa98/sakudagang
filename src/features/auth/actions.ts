// Server Action autentikasi.
//
// "use server" membuat setiap fungsi di file ini bisa dipanggil dari browser
// (Next.js membuatkan endpoint POST di belakang layar). Artinya fungsi ini
// adalah PINTU PUBLIK: siapa pun bisa memanggilnya dengan data apa pun.
// Karena itu urutannya selalu: validasi → cek → baru ubah data.
//
// Baru ada logout. login() menyusul: validasi zod → rate limit → verifyPassword
// (lib/auth/password.ts) → createSession (lib/auth/session.ts) → redirect("/").
//
// Referensi:
// - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
// - node_modules/next/dist/docs/01-app/02-guides/forms.md (bagian useActionState)
// - node_modules/next/dist/docs/01-app/02-guides/authentication.md

"use server";

import { destroySession } from "@/lib/auth/session";

// Logout sengaja TIDAK memanggil redirect(). Halaman tujuan dibuka oleh
// browser lewat reload penuh (lihat hooks/use-logout.ts), karena dengan
// cacheComponents Next.js menyimpan halaman sebelumnya secara tersembunyi
// (React <Activity>). Reload penuh memastikan tidak ada sisa data user di
// DOM maupun memori browser setelah logout.
// Referensi: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md
export async function logout() {
  await destroySession();
}
