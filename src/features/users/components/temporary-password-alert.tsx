// Menampilkan password sementara SEKALI setelah akun dibuat / di-reset,
// dengan tombol salin, tombol kirim undangan via WhatsApp (Fonnte, lewat
// Server Action sendInvitationWhatsApp), dan status pengiriman email:
// - null : email hanya syarat login (nama@...), tidak dikirim → kirim via WhatsApp
// - true : terkirim ke email pengguna
// - false: gagal terkirim → kirim via WhatsApp
//
// Bila nomor belum diisi, tombolnya mengarah ke halaman detail pengguna
// untuk melengkapi nomor.
//
// Referensi: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText

"use client";

import { CheckIcon, CopyIcon, KeyRoundIcon, LoaderCircleIcon, MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendInvitationWhatsApp, type EmailStatus } from "@/features/users/actions";
import { notify } from "@/lib/notify";
import { formatPhone } from "@/lib/phone";

export function TemporaryPasswordAlert({
  title,
  userId,
  fullName,
  email,
  phone,
  password,
  emailSent,
  kind,
}: {
  title: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  password: string;
  emailSent: EmailStatus;
  kind: "created" | "reset";
}) {
  const [copied, setCopied] = useState(false);
  const [sending, startSending] = useTransition();
  const [whatsappSent, setWhatsappSent] = useState(false);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Gagal menyalin. Salin manual dari kotak di atas.");
    }
  }

  function sendWhatsApp() {
    startSending(async () => {
      const result = await sendInvitationWhatsApp(userId, password, kind);
      if (!result.success) {
        notify.error(result.message);
        return;
      }
      setWhatsappSent(true);
      notify.success(`Undangan dikirim ke ${formatPhone(phone!)}.`);
    });
  }

  return (
    <Alert variant={emailSent === false ? "destructive" : "default"}>
      <KeyRoundIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          {emailSent === true && (
            <>
              Password sudah dikirim ke <span className="font-medium text-foreground">{email}</span>.
            </>
          )}
          {emailSent === null && (
            <>
              Email <span className="font-medium text-foreground">{email}</span> dianggap hanya syarat login (sama
              dengan nama depan), jadi tidak ada email yang dikirim.
            </>
          )}
          {emailSent === false && (
            <>
              Email ke <span className="font-medium text-foreground">{email}</span> gagal dikirim.
            </>
          )}{" "}
          {phone
            ? `Kirim undangan ke ${fullName} lewat WhatsApp (${formatPhone(phone)}).`
            : `Nomor WhatsApp ${fullName} belum diisi; lengkapi di detail pengguna untuk mengirim undangan.`}{" "}
          Password hanya ditampilkan sekali; pengguna wajib menggantinya saat login pertama.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md border bg-muted px-3 py-1.5 font-mono text-base tracking-wider text-foreground select-all">
            {password}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copyPassword}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Tersalin" : "Salin password"}
          </Button>
          {phone ? (
            <Button
              type="button"
              variant={whatsappSent ? "outline" : "brand"}
              size="sm"
              disabled={sending}
              onClick={sendWhatsApp}
            >
              {sending ? <LoaderCircleIcon className="animate-spin" /> : whatsappSent ? <CheckIcon /> : <MessageCircleIcon />}
              {sending ? "Mengirim..." : whatsappSent ? "Kirim ulang via WhatsApp" : "Kirim undangan via WhatsApp"}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/users/${userId}`} />}>
              Lengkapi nomor WhatsApp
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
