// Server Action Pengaturan platform (settings:manage, hanya Superadmin):
// kontak admin, rekening pembayaran, masa gratis & tenggang, gambar QRIS statis.
// Harga paket & harga khusus per toko ada di features/subscriptions/actions.ts.

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { getPlatformSettings, PLATFORM_SETTINGS_ID } from "@/lib/platform-settings";
import { deleteObject, putObject } from "@/lib/storage";
import type { ActionResult } from "@/types/action-result";
import { platformSettingsSchema, QRIS_IMAGE_TYPES, QRIS_MAX_BYTES } from "./schemas";

const FORBIDDEN = { success: false, message: "Anda tidak memiliki akses." } as const;

export async function updatePlatformSettings(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "settings:manage")) return FORBIDDEN;

  const parsed = platformSettingsSchema.safeParse({
    adminPhone: formData.get("adminPhone") ?? "",
    bankName: formData.get("bankName") ?? "",
    bankAccountNumber: formData.get("bankAccountNumber") ?? "",
    bankAccountName: formData.get("bankAccountName") ?? "",
    freeDays: formData.get("freeDays") ?? "",
    graceDays: formData.get("graceDays") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      message: "Periksa kembali isian Anda.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  await db
    .insert(platformSettings)
    .values({ id: PLATFORM_SETTINGS_ID, ...parsed.data })
    .onConflictDoUpdate({ target: platformSettings.id, set: parsed.data });

  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}

// Unggah/ganti gambar QRIS statis. File dari form (input type="file" name="qris").
export async function uploadQrisImage(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "settings:manage")) return FORBIDDEN;

  const file = formData.get("qris");
  if (!(file instanceof File) || file.size === 0) return { success: false, message: "Pilih file gambar QRIS." };
  if (!(QRIS_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { success: false, message: "Format harus PNG, JPG, atau WebP." };
  }
  if (file.size > QRIS_MAX_BYTES) return { success: false, message: "Ukuran gambar maksimal 2 MB." };

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `platform/qris-${crypto.randomUUID()}.${extension}`;
  await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);

  const previous = (await getPlatformSettings()).qrisImageKey;
  await db
    .insert(platformSettings)
    .values({ id: PLATFORM_SETTINGS_ID, qrisImageKey: key })
    .onConflictDoUpdate({ target: platformSettings.id, set: { qrisImageKey: key } });
  if (previous) await deleteObject(previous).catch(() => undefined);

  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}

export async function removeQrisImage(): Promise<ActionResult> {
  const actor = await verifySession();
  if (!can(actor, "settings:manage")) return FORBIDDEN;

  const previous = (await getPlatformSettings()).qrisImageKey;
  await db.update(platformSettings).set({ qrisImageKey: null }).where(eq(platformSettings.id, PLATFORM_SETTINGS_ID));
  if (previous) await deleteObject(previous).catch(() => undefined);

  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}
