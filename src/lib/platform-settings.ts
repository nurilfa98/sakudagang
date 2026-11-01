// Pengaturan platform (satu baris, id "default"): kontak admin, QRIS statis,
// masa gratis & tenggang, diskon paket, perlindungan bulan sepi. Rekening bank: features/settings/queries.ts. Di lib/ karena dibaca lib/auth/dal.ts
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
  discount6: number; // persen, paket 6 bulan
  discount12: number; // persen, paket 1 tahun
  // Perlindungan bulan sepi paket 6 bulan & 1 tahun (BUSINESS-FLOW §14.8).
  reliefDays: number; // hari tambahan; 0 = tidak ditawarkan
  reliefDropPercent: number; // batas penurunan omzet (%)
  reliefMax6: number; // jatah per paket 6 bulan
  reliefMax12: number; // jatah per paket 1 tahun
};

const DEFAULTS: PlatformSettings = {
  adminPhone: null,
  qrisImageKey: null,
  freeDays: 14,
  graceDays: 3,
  discount6: 10,
  discount12: 20,
  reliefDays: 10,
  reliefDropPercent: 20,
  reliefMax6: 1,
  reliefMax12: 2,
};

// Baris dibuat oleh migration 0000_init; bila entah kenapa hilang, pakai bawaan
// agar login tetap berjalan.
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const [row] = await db
    .select({
      adminPhone: platformSettings.adminPhone,
      qrisImageKey: platformSettings.qrisImageKey,
      freeDays: platformSettings.freeDays,
      graceDays: platformSettings.graceDays,
      discount6: platformSettings.discount6,
      discount12: platformSettings.discount12,
      reliefDays: platformSettings.reliefDays,
      reliefDropPercent: platformSettings.reliefDropPercent,
      reliefMax6: platformSettings.reliefMax6,
      reliefMax12: platformSettings.reliefMax12,
    })
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);
  return row ?? DEFAULTS;
}
