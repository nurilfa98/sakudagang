// Isi pesan WhatsApp undangan login (akun baru & reset password), dikirim
// lewat Fonnte (lib/whatsapp.ts) saat admin menekan tombol
// "Kirim undangan via WhatsApp".
//
// Format teks WhatsApp: *tebal*, _miring_. Dibiarkan polos agar mudah disalin.

import "server-only";
import { PRODUCT_NAME } from "@/lib/brand";
import { env } from "@/lib/env";
import { sendWhatsApp } from "@/lib/whatsapp";

type InvitationInput = {
  fullName: string;
  email: string;
  phone: string; // format 62…
  temporaryPassword: string;
  kind: "created" | "reset";
};

export function invitationText(input: Omit<InvitationInput, "phone">) {
  const loginUrl = new URL("/login", env.NEXT_PUBLIC_APP_URL).toString();
  const intro =
    input.kind === "created"
      ? `Halo ${input.fullName}, akun ${PRODUCT_NAME} Anda sudah dibuat.`
      : `Halo ${input.fullName}, password akun ${PRODUCT_NAME} Anda telah di-reset.`;

  return [
    intro,
    "",
    `Alamat: ${loginUrl}`,
    `Email: ${input.email}`,
    `Password sementara: ${input.temporaryPassword}`,
    "",
    "Setelah masuk, Anda diminta membuat password baru.",
  ].join("\n");
}

// true bila pesan diterima Fonnte (belum tentu sudah sampai di HP penerima).
export function sendInvitation(input: InvitationInput) {
  return sendWhatsApp({ to: input.phone, text: invitationText(input) });
}
