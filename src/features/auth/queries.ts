// Query database khusus fitur auth.
//
// Kedua fungsi di sini mengembalikan password_hash, jadi hanya boleh dipanggil
// dari Server Action auth. Jangan pernah mengirim hasilnya ke komponen.
//
// Referensi: node_modules/next/dist/docs/01-app/02-guides/data-security.md
// (bagian "Data Access Layer")

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stores, users } from "@/lib/db/schema";

const credentialColumns = {
  id: users.id,
  // Role menentukan halaman pertama setelah login / ganti password.
  role: users.role,
  passwordHash: users.passwordHash,
  isActive: users.isActive,
  mustChangePassword: users.mustChangePassword,
  sessionVersion: users.sessionVersion,
};

// Ikut membaca status toko agar login bisa memberi pesan yang jelas
// (toko dinonaktifkan / langganan habis), lihat features/auth/actions.ts.
export async function findUserForLogin(email: string) {
  const [user] = await db
    .select({
      ...credentialColumns,
      storeIsActive: stores.isActive,
      storeSubscriptionUntil: stores.subscriptionUntil,
    })
    .from(users)
    .leftJoin(stores, eq(users.storeId, stores.id))
    .where(eq(users.email, email))
    .limit(1);

  return user;
}

// Dipakai saat ganti password. Sengaja TIDAK lewat getCurrentUser() di DAL:
// hasil getCurrentUser() di-cache selama satu request, sehingga setelah
// password diganti, redirect di request yang sama masih membaca data lama
// (mustChangePassword: true) dan user terlempar balik ke /change-password.
export async function findUserCredentials(userId: string) {
  const [user] = await db.select(credentialColumns).from(users).where(eq(users.id, userId)).limit(1);

  return user;
}
