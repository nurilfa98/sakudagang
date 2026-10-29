// Pengaturan platform (satu baris, id "default"): kontak admin, QRIS statis,
// masa gratis & tenggang. Rekening bank: features/settings/queries.ts. Di lib/ karena dibaca lib/auth/dal.ts
// (masa tenggang menentukan akses) dan features/stores (masa gratis toko baru).
// Diubah Superadmin lewat features/settings/actions.ts.

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";

export const PLATFORM_SETTINGS_ID = "default";

export type PlatformSettings = {
  adminPhone: string | null;
  qrisImageKey: string | null;
  freeDays: number;
  graceDays: number;
};

const DEFAULTS: PlatformSettings = {
  adminPhone: null,
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
      qrisImageKey: platformSettings.qrisImageKey,
      freeDays: platformSettings.freeDays,
      graceDays: platformSettings.graceDays,
    })
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);
  return row ?? DEFAULTS;
}
