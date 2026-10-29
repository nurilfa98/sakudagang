// GET /api/qris: gambar QRIS statis SakuDagang untuk halaman Langganan.
// Wajib login (user mana pun); file disimpan privat di lib/storage.ts.
// - R2: dialihkan ke presigned URL (5 menit).
// - Lokal (development): isi file dikirim langsung.
//
// Referensi: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getPresignedUrl, readLocalObject } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { qrisImageKey } = await getPlatformSettings();
  if (!qrisImageKey) return NextResponse.json({ error: "QRIS belum diunggah" }, { status: 404 });

  const presigned = await getPresignedUrl(qrisImageKey);
  if (presigned) return NextResponse.redirect(presigned, { headers: { "Cache-Control": "private, no-store" } });

  const body = await readLocalObject(qrisImageKey);
  const extension = qrisImageKey.split(".").pop() ?? "png";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
