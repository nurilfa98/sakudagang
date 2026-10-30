// Server Action untuk kelola pengguna.
//
// Setiap action mengecek hak akses sendiri (canManageRoleInStore /
// canManageUser di service.ts), walaupun halamannya sudah dilindungi:
// Server Action bisa dipanggil langsung lewat POST tanpa membuka halamannya.
//
// Aturan penting:
// - User TIDAK dihapus, hanya dinonaktifkan, agar riwayat transaksi tetap utuh.
// - Tidak ada yang bisa menonaktifkan / me-reset akunnya sendiri.
// - Password sementara dikembalikan sekali ke pembuat akun untuk disampaikan
//   langsung (WhatsApp). Setelah itu tidak bisa dilihat lagi: yang tersimpan
//   hanya hash-nya. Bila emailnya email sungguhan (bukan "email syarat login",
//   lihat isPlaceholderEmail di service.ts), kredensial juga dikirim ke email.
//
// Referensi:
// - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
// - node_modules/next/dist/docs/01-app/02-guides/data-security.md
//   (bagian "Authentication and authorization")

"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/password";
import { db, isUniqueViolation } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { ActionResult } from "@/types/action-result";
import { sendEmail } from "@/lib/email";
import { getStore } from "@/features/stores/queries";
import { credentialsEmail } from "./emails";
import { getUserDetail } from "./queries";
import { createUserSchema, updateUserSchema, userIdSchema } from "./schemas";
import { canEditUser, canManageRoleInStore, canManageUser, isPlaceholderEmail } from "./service";
import { sendInvitation } from "./whatsapp";

const FORBIDDEN = { success: false, message: "Anda tidak memiliki akses." } as const;
const NOT_FOUND = { success: false, message: "Pengguna tidak ditemukan." } as const;
const EMAIL_TAKEN = {
  success: false as const,
  message: "Periksa kembali isian Anda.",
  fieldErrors: { email: ["Email sudah dipakai pengguna lain"] },
};

// ---------------------------------------------------------------------------
// Tambah pengguna
// ---------------------------------------------------------------------------

// emailSent: true = terkirim, false = gagal, null = tidak dikirim karena
// emailnya hanya syarat login.
export type EmailStatus = boolean | null;

export type CreateUserResult = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  temporaryPassword: string;
  emailSent: EmailStatus;
};

export async function createUser(
  _prevState: ActionResult<CreateUserResult> | undefined,
  formData: FormData,
): Promise<ActionResult<CreateUserResult>> {
  const actor = await verifySession();

  const parsed = createUserSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role"),
    storeId: formData.get("storeId"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { fullName, email, phone, role, storeId } = parsed.data;
  if (!canManageRoleInStore(actor, role, storeId)) return FORBIDDEN;

  const store = await getStore(storeId);
  if (!store) return { success: false, message: "Toko tidak ditemukan." };
  if (!store.isActive) return { success: false, message: "Toko ini nonaktif. Aktifkan toko terlebih dahulu." };

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  let userId: string;
  try {
    const [created] = await db
      .insert(users)
      .values({ fullName, email, phone, role, storeId, passwordHash, mustChangePassword: true })
      .returning({ id: users.id });
    userId = created.id;
  } catch (error) {
    // Email ganda ditolak oleh UNIQUE constraint di database, bukan dengan
    // "cek dulu baru insert", agar tetap aman walau dua admin submit bersamaan.
    if (isUniqueViolation(error)) return EMAIL_TAKEN;
    throw error;
  }

  // Email dikirim SETELAH user tersimpan. Kalau gagal, user tetap ada; admin
  // bisa menyampaikan password lewat WhatsApp atau me-reset untuk kirim ulang.
  const emailSent = await sendCredentials({ fullName, email, storeName: store.name, temporaryPassword, kind: "created" });

  revalidateUsers();
  return { success: true, data: { id: userId, fullName, email, phone, temporaryPassword, emailSent } };
}

// ---------------------------------------------------------------------------
// Edit nama & email
// ---------------------------------------------------------------------------

export async function updateUser(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await verifySession();

  const userId = userIdSchema.safeParse(formData.get("userId"));
  if (!userId.success) return NOT_FOUND;

  const parsed = updateUserSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error);

  const target = await getUserDetail(userId.data);
  if (!target) return NOT_FOUND;
  // Pengelola, atau pengguna itu sendiri (Profile).
  if (!canEditUser(actor, target)) return FORBIDDEN;

  try {
    await db.update(users).set(parsed.data).where(eq(users.id, target.id));
  } catch (error) {
    if (isUniqueViolation(error)) return EMAIL_TAKEN;
    throw error;
  }

  revalidateUsers();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Aktifkan / nonaktifkan
// ---------------------------------------------------------------------------

// Dipanggil dari event handler (bukan form), jadi argumennya bisa dikirim
// siapa saja dengan nilai apa saja. Keduanya divalidasi ulang dengan zod.
export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const actor = await verifySession();

  const input = z.object({ userId: userIdSchema, active: z.boolean() }).safeParse({ userId, active });
  if (!input.success) return NOT_FOUND;
  if (input.data.userId === actor.id) {
    return { success: false, message: "Anda tidak bisa menonaktifkan akun sendiri." };
  }

  const target = await getUserDetail(input.data.userId);
  if (!target) return NOT_FOUND;
  if (!canManageUser(actor, target)) return FORBIDDEN;

  // Cookie session user yang dinonaktifkan masih tersimpan di browsernya,
  // tapi getCurrentUser() di DAL mengecek is_active, jadi aksesnya berhenti
  // di request berikutnya.
  await db.update(users).set({ isActive: input.data.active }).where(eq(users.id, target.id));

  revalidateUsers();
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Reset password
// ---------------------------------------------------------------------------

// Membuat password sementara baru dan mengeluarkan user dari semua perangkat
// (sessionVersion + 1). Password dikembalikan sekali ke pemanggil, dan dikirim
// ke email bila emailnya sungguhan.
export async function resetUserPassword(
  userId: string,
): Promise<ActionResult<{ temporaryPassword: string; emailSent: EmailStatus }>> {
  const actor = await verifySession();

  const id = userIdSchema.safeParse(userId);
  if (!id.success) return NOT_FOUND;
  if (id.data === actor.id) {
    return { success: false, message: "Untuk akun sendiri, gunakan menu Ganti password." };
  }

  const target = await getUserDetail(id.data);
  if (!target) return NOT_FOUND;
  if (!canManageUser(actor, target)) return FORBIDDEN;
  if (!target.isActive) {
    return { success: false, message: "Aktifkan akun ini terlebih dahulu sebelum me-reset password." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      // Dinaikkan langsung di database (bukan dibaca lalu ditulis) agar
      // tetap benar bila ada dua reset bersamaan.
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, target.id));

  const emailSent = await sendCredentials({
    fullName: target.fullName,
    email: target.email,
    storeName: target.storeName,
    temporaryPassword,
    kind: "reset",
  });

  revalidateUsers();
  return { success: true, data: { temporaryPassword, emailSent } };
}

// ---------------------------------------------------------------------------
// Undangan login via WhatsApp (Fonnte)
// ---------------------------------------------------------------------------

// Dipanggil dari tombol di panel password sementara. Password sementara
// hanya ada di layar admin (tidak tersimpan selain hash-nya), jadi dikirim
// balik dari browser. Isinya tidak bisa disalahgunakan: templat pesan tetap,
// nilainya dibatasi pola password sementara, dan hanya untuk user yang masih
// wajib mengganti password (password sementaranya masih berlaku).
export async function sendInvitationWhatsApp(
  userId: string,
  temporaryPassword: string,
  kind: "created" | "reset",
): Promise<ActionResult> {
  const actor = await verifySession();

  const input = z
    .object({
      userId: userIdSchema,
      temporaryPassword: z.string().regex(/^[A-Za-z0-9]{8,32}$/),
      kind: z.enum(["created", "reset"]),
    })
    .safeParse({ userId, temporaryPassword, kind });
  if (!input.success) return NOT_FOUND;

  const target = await getUserDetail(input.data.userId);
  if (!target) return NOT_FOUND;
  if (!canManageUser(actor, target)) return FORBIDDEN;
  if (!target.phone) return { success: false, message: "Nomor WhatsApp pengguna belum diisi." };
  if (!target.mustChangePassword) {
    return { success: false, message: "Pengguna sudah mengganti password; undangan tidak lagi berlaku." };
  }

  const sent = await sendInvitation({
    fullName: target.fullName,
    email: target.email,
    phone: target.phone,
    temporaryPassword: input.data.temporaryPassword,
    kind: input.data.kind,
  });
  if (!sent) return { success: false, message: "Pesan WhatsApp gagal dikirim. Coba lagi atau salin passwordnya." };

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Helper (tanpa export → bukan Server Action, tidak bisa dipanggil dari browser)
// ---------------------------------------------------------------------------

// null bila email hanya syarat login (tidak dikirim), selain itu hasil kirim.
async function sendCredentials(input: Parameters<typeof credentialsEmail>[0]): Promise<EmailStatus> {
  if (isPlaceholderEmail(input.fullName, input.email)) return null;
  return sendEmail(credentialsEmail(input));
}

function invalid(error: z.ZodError) {
  return {
    success: false as const,
    message: "Periksa kembali isian Anda.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

// "layout" mencakup /users, /users/new, dan /users/[id]. Daftar toko
// menampilkan nama pemilik & jumlah pengguna, jadi ikut dimuat ulang.
function revalidateUsers() {
  revalidatePath("/users", "layout");
  revalidatePath("/stores", "layout");
}
