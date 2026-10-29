// GET /api/subscriptions/[id]/proof: bukti transfer satu tagihan.
// Boleh dibuka oleh Superadmin dan Pemilik toko pemilik tagihan itu (toko
// terkunci pun boleh, agar pemilik bisa melihat bukti yang ia kirim).
// File privat di lib/storage.ts: R2 → presigned URL, lokal → isi file.

import { NextResponse } from "next/server";
import { getSubscriptionProof } from "@/features/subscriptions/queries";
import { getCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getPresignedUrl, readLocalObject } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function GET(_request: Request, { params }: RouteContext<"/api/subscriptions/[id]/proof">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const proof = id.length <= 36 ? await getSubscriptionProof(id) : null;
  // Tidak berhak = "tidak ditemukan", agar keberadaan tagihan toko lain tidak bocor.
  const allowed =
    proof?.proofKey && (can(user, "subscription:manage") || (can(user, "subscription:view") && user.activeStore?.id === proof.storeId));
  if (!proof || !allowed || !proof.proofKey) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const presigned = await getPresignedUrl(proof.proofKey);
  if (presigned) return NextResponse.redirect(presigned, { headers: { "Cache-Control": "private, no-store" } });

  const body = await readLocalObject(proof.proofKey);
  const extension = proof.proofKey.split(".").pop() ?? "";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
