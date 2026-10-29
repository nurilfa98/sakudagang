// Pengaturan platform (satu baris, id "default"): kontak admin, rekening,
// QRIS statis, masa gratis & tenggang. Di lib/ karena dibaca lib/auth/dal.ts
// (masa tenggang menentukan akses) dan features/stores (masa gratis toko baru).
// Diubah Superadmin lewat features/settings/actions.ts.

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";

export const PLATFORM_SETTINGS_ID = "default";

export type PlatformSettings = {
  adminPhone: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  qrisImageKey: string | null;
  freeDays: number;
  graceDays: number;
};

const DEFAULTS: PlatformSettings = {
  adminPhone: null,
  bankName: null,
  bankAccountNumber: null,
  bankAccountName: null,
  qrisImageKey: null,
  freeDays: 14,
  graceDays: 3,
};

// Baris dibuat oleh migration 0006; bila entah kenapa hilang, pakai bawaan
// agar login tetap berjalan.
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const [row] = await db
    .select({
      adminPhone: platformSettings.adminPhone,
      bankName: platformSettings.bankName,
      bankAccountNumber: platformSettings.bankAccountNumber,
      bankAccountName: platformSettings.bankAccountName,
      qrisImageKey: platformSettings.qrisImageKey,
      freeDays: platformSettings.freeDays,
      graceDays: platformSettings.graceDays,
    })
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);
  return row ?? DEFAULTS;
}
