// "Toko aktif" untuk SUPERADMIN.
//
// Pemilik/Kasir terikat satu toko (users.store_id). Superadmin tidak terikat,
// tetapi boleh MASUK ke toko mana pun untuk mengelolanya (BUSINESS-FLOW §2).
// Toko yang sedang dibuka disimpan di cookie ini; lib/auth/dal.ts membacanya
// dan memverifikasi tokonya ada, lalu requireStore() memakainya sebagai
// storeId. Dengan begitu semua fitur toko bekerja untuk Superadmin tanpa
// kode khusus.
//
// Cookie berisi id toko saja (tanpa tanda tangan): Superadmin memang berhak
// ke semua toko, dan nilainya selalu dicocokkan ke database. Untuk user lain
// cookie ini diabaikan.
//
// Referensi: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md

import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE_NAME = "sakudagang_store";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 hari

export async function readActiveStoreCookie() {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return value && value.length <= 36 ? value : null;
}

// Hanya boleh dipanggil dari Server Action / Route Handler (menulis cookie).
export async function setActiveStoreCookie(storeId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, storeId, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearActiveStoreCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
