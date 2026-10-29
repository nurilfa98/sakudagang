// Aksi per baris tagihan terbuka di halaman Tagihan (Superadmin).
// Aksi baru muncul setelah pemilik menekan "Saya sudah bayar" (CLAIMED):
// Bukti, Tandai lunas, Tolak (alasan wajib), Batalkan. Saat masih PENDING
// admin hanya menunggu, agar alur selalu lewat klaim + bukti dari pemilik.
// Hanya "Tandai lunas" yang memperpanjang masa toko.

"use client";

import { CheckIcon, FileSearchIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { confirmSubscriptionPaid, rejectSubscriptionClaim } from "@/features/subscriptions/actions";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import type { SubscriptionItem } from "@/features/subscriptions/queries";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { CancelInvoiceButton } from "./cancel-invoice-button";
import { ProofPreview } from "./proof-preview";

export function BillingRowActions({ subscription }: { subscription: SubscriptionItem }) {
  const [dialog, setDialog] = useState<"confirm" | "reject" | "proof" | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const claimed = subscription.status === "CLAIMED";

  function open(next: "confirm" | "reject" | "proof") {
    setText("");
    setDialog(next);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmSubscriptionPaid(subscription.id, text);
      if (!result.success) notify.error(result.message);
      else {
        notify.success(`Langganan ${subscription.storeName} diperpanjang.`);
        setDialog(null);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectSubscriptionClaim(subscription.id, text);
      if (!result.success) notify.error(result.message);
      else {
        notify.success("Klaim ditolak. Pemilik melihat alasannya di halaman Langganan.");
        setDialog(null);
      }
    });
  }

  if (!claimed) {
    return <span className="text-xs whitespace-nowrap text-muted-foreground">Menunggu pemilik</span>;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {subscription.proofType && (
        <Button size="sm" variant="outline" onClick={() => open("proof")}>
          <FileSearchIcon />
          Bukti
        </Button>
      )}
      <Button size="sm" onClick={() => open("confirm")}>
        <CheckIcon />
        Tandai lunas
      </Button>
      <Button size="sm" variant="edit" onClick={() => open("reject")}>
        <XIcon />
        Tolak
      </Button>
      <CancelInvoiceButton subscriptionId={subscription.id} compact />

      {/* Pratinjau bukti transfer; dari sini admin bisa langsung tandai lunas / tolak. */}
      <AlertDialog open={dialog === "proof"} onOpenChange={(next) => !next && setDialog(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Bukti transfer: {subscription.storeName}</AlertDialogTitle>
            <AlertDialogDescription>
              Paket {PLAN_LABELS[subscription.months]} sebesar {formatRupiah(subscription.price)}
              {subscription.claimedAtLabel ? `, dikirim ${subscription.claimedAtLabel}` : ""}.
              {subscription.note ? ` Catatan pemilik: ${subscription.note}.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {subscription.proofType && <ProofPreview subscriptionId={subscription.id} type={subscription.proofType} mode="full" />}
          <AlertDialogFooter>
            <AlertDialogCancel>Tutup</AlertDialogCancel>
            <Button variant="destructive" onClick={() => open("reject")}>
              <XIcon />
              Tolak
            </Button>
            <Button onClick={() => open("confirm")}>
              <CheckIcon />
              Tandai lunas
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "confirm" || dialog === "reject"} onOpenChange={(next) => !pending && !next && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog === "reject" ? "Tolak klaim pembayaran?" : "Tandai lunas?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {subscription.storeName}: paket {PLAN_LABELS[subscription.months]} sebesar {formatRupiah(subscription.price)}.{" "}
              {dialog === "reject"
                ? "Tagihan kembali ke “menunggu pembayaran” dan alasan Anda tampil ke pemilik. Bukti yang dikirim tetap tersimpan."
                : "Masa berlangganan toko langsung diperpanjang."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor={`text-${subscription.id}`}>{dialog === "reject" ? "Alasan penolakan" : "Catatan (opsional)"}</FieldLabel>
            <Input
              id={`text-${subscription.id}`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                dialog === "reject" ? "Dana belum masuk ke rekening per 29 Okt 16.00" : "Transfer BCA 28/10, ref 1234"
              }
              maxLength={255}
              required={dialog === "reject"}
            />
            <FieldDescription>
              {dialog === "reject"
                ? "Tulis yang bisa ditindaklanjuti pemilik, misalnya nominal atau rekening tujuan yang keliru."
                : "Referensi transfer atau keterangan lain."}
            </FieldDescription>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <Button
              variant={dialog === "reject" ? "destructive" : "brand"}
              disabled={pending}
              onClick={dialog === "reject" ? handleReject : handleConfirm}
            >
              {pending && <LoaderCircleIcon className="animate-spin" />}
              {dialog === "reject" ? "Tolak klaim" : "Tandai lunas"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
