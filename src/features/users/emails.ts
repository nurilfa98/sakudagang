// Isi email kredensial login (akun baru & reset password).
//
// Email berisi password sementara. Risikonya diperkecil karena password hanya
// berlaku sampai login pertama (wajib diganti). Email TIDAK dikirim untuk
// "email syarat login" (lihat isPlaceholderEmail di service.ts).

import "server-only";
import { escapeHtml, type EmailMessage } from "@/lib/email";
import { env } from "@/lib/env";
import { PRODUCT_NAME } from "@/lib/brand";

type CredentialsEmailInput = {
  fullName: string;
  email: string;
  storeName: string | null;
  temporaryPassword: string;
  kind: "created" | "reset";
};

export function credentialsEmail(input: CredentialsEmailInput): EmailMessage {
  const loginUrl = new URL("/login", env.NEXT_PUBLIC_APP_URL).toString();
  const storeNote = input.storeName ? ` untuk ${input.storeName}` : "";
  const intro =
    input.kind === "created"
      ? `Akun ${PRODUCT_NAME} Anda${storeNote} sudah dibuat.`
      : `Password akun ${PRODUCT_NAME} Anda${storeNote} telah di-reset oleh admin.`;
  const subject = input.kind === "created" ? `Akun ${PRODUCT_NAME} Anda` : `Password ${PRODUCT_NAME} Anda di-reset`;

  const text = [
    `Halo ${input.fullName},`,
    "",
    intro,
    "",
    `Alamat: ${loginUrl}`,
    `Email: ${input.email}`,
    `Password sementara: ${input.temporaryPassword}`,
    "",
    "Setelah masuk, Anda akan diminta membuat password baru.",
    "Jangan bagikan password ini kepada siapa pun.",
  ].join("\n");

  const html = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #171717;">
  <p>Halo ${escapeHtml(input.fullName)},</p>
  <p>${escapeHtml(intro)}</p>
  <table style="border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 4px 12px 4px 0; color: #737373;">Email</td><td>${escapeHtml(input.email)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #737373;">Password sementara</td>
      <td><code style="font-size: 16px; background: #f5f5f5; padding: 2px 6px; border-radius: 4px;">${escapeHtml(input.temporaryPassword)}</code></td></tr>
  </table>
  <p><a href="${escapeHtml(loginUrl)}" style="display: inline-block; background: #0369a1; color: #ffffff; padding: 8px 16px; border-radius: 6px; text-decoration: none;">Masuk ke ${escapeHtml(PRODUCT_NAME)}</a></p>
  <p>Setelah masuk, Anda akan diminta membuat password baru.<br />
  Jangan bagikan password ini kepada siapa pun.</p>
</div>`;

  return { to: input.email, subject, text, html };
}
