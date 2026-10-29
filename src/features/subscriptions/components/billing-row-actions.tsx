// Aksi per baris tagihan di halaman Tagihan (Superadmin) untuk pembayaran
// yang menunggu konfirmasi: Bukti (dialog pratinjau), Terima (isi nominal
// yang masuk; lunas bila total ≥ harga, selain itu kurang bayar), Tolak
// (alasan wajib; tagihan ditolak final bila belum ada yang diterima).
// Tidak ada Batalkan. Hanya pembayaran yang diterima sampai lunas yang
// memperpanjang masa toko. Tombol berupa ikon + tooltip agar tabel tidak
// melebar; warna: Terima brand, Tolak oranye (variant edit, sama di dialog).

"use client";

import { CheckIcon, FileSearchIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { RupiahInput } from "@/components/rupiah-input";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { acceptPayment, rejectPayment } from "@/features/subscriptions/actions";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import type { SubscriptionItem } from "@/features/subscriptions/queries";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { ProofPreview } from "./proof-preview";

type Dialog = "proof" | "accept" | "reject" | null;

export function BillingRowActions({ subscription }: { subscription: SubscriptionItem }) {
  const payment = subscription.pendingPayment;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const remaining = Math.max(subscription.price - subscription.amountPaid, 0);

  if (!payment) return null;
  const paymentId = payment.id;

  function open(next: Exclude<Dialog, null>) {
    setText("");
    setAmount(String(remaining));
    setDialog(next);
  }

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptPayment(paymentId, amount, text);
      if (!result.success) notify.error(result.message);
      else {
        if (result.data.remaining > 0) {
          notify.warning(`Diterima. Masih kurang ${formatRupiah(result.data.remaining)}; pemilik diminta melengkapi.`);
        } else {
          notify.success(`Lunas. Langganan ${subscription.storeName} diperpanjang.`);
        }
        setDialog(null);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectPayment(paymentId, text);
      if (!result.success) notify.error(result.message);
      else {
        notify.success("Pembayaran ditolak. Pemilik melihat alasannya di halaman Langganan.");
        setDialog(null);
      }
    });
  }

  // Ringkasan tagihan; bagian kurang bayar disorot amber agar admin langsung
  // sadar saat memeriksa bukti pelunasan.
  const summary = (
    <>
      {subscription.storeName}: paket {PLAN_LABELS[subscription.months]}, tagihan {formatRupiah(subscription.price)}
      {subscription.amountPaid > 0 && (
        <span className="font-medium text-amber-700 dark:text-amber-300">
          , sudah diterima {formatRupiah(subscription.amountPaid)}, kurang {formatRupiah(remaining)}
        </span>
      )}
      .
    </>
  );

  return (
    <div className="flex items-center justify-end gap-1">
      {payment.proofType && (
        <IconAction label="Lihat bukti transfer" variant="outline" onClick={() => open("proof")}>
          <FileSearchIcon />
        </IconAction>
      )}
      <IconAction label="Terima pembayaran" variant="brand" onClick={() => open("accept")}>
        <CheckIcon />
      </IconAction>
      <IconAction label="Tolak pembayaran" variant="edit" onClick={() => open("reject")}>
        <XIcon />
      </IconAction>

      {/* Pratinjau bukti; dari sini admin bisa langsung terima / tolak. */}
      <AlertDialog open={dialog === "proof"} onOpenChange={(next) => !next && setDialog(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Bukti transfer: {subscription.storeName}</AlertDialogTitle>
            <AlertDialogDescription>
              {summary} Dikirim {payment.createdAtLabel}.{payment.note ? ` Catatan pemilik: ${payment.note}.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {payment.proofType && <ProofPreview paymentId={payment.id} type={payment.proofType} mode="full" />}
          <AlertDialogFooter>
            <AlertDialogCancel>Tutup</AlertDialogCancel>
            <Button variant="edit" onClick={() => open("reject")}>
              <XIcon />
              Tolak
            </Button>
            <Button onClick={() => open("accept")}>
              <CheckIcon />
              Terima
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "accept" || dialog === "reject"} onOpenChange={(next) => !pending && !next && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog === "reject" ? "Tolak pembayaran ini?" : "Terima pembayaran"}</AlertDialogTitle>
            <AlertDialogDescription>
              {summary}{" "}
              {dialog === "reject"
                ? subscription.amountPaid > 0
                  ? "Tagihan kembali kurang bayar; alasan Anda tampil ke pemilik."
                  : "Tagihan ditandai Ditolak dan alasan Anda tampil ke pemilik; pemilik bisa mengajukan ulang dari pilihan paket. Bukti tetap tersimpan."
                : "Isi nominal yang benar-benar masuk ke rekening. Bila mencukupi, masa berlangganan toko langsung diperpanjang; bila kurang, pemilik diminta melengkapi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialog === "accept" && (
            <Field>
              <FieldLabel htmlFor={`amount-${paymentId}`}>Nominal diterima</FieldLabel>
              <RupiahInput
                id={`amount-${paymentId}`}
                defaultValue={remaining}
                onValueChange={(value) => setAmount(value == null ? "" : String(value))}
              />
              <FieldDescription>Kekurangan saat ini {formatRupiah(remaining)}.</FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor={`text-${paymentId}`}>{dialog === "reject" ? "Alasan penolakan" : "Keterangan (opsional)"}</FieldLabel>
            <Input
              id={`text-${paymentId}`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={dialog === "reject" ? "Dana belum masuk ke rekening per 29 Okt 16.00" : "Transfer BCA 28/10, ref 1234"}
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
              variant={dialog === "reject" ? "edit" : "brand"}
              disabled={pending}
              onClick={dialog === "reject" ? handleReject : handleAccept}
            >
              {pending && <LoaderCircleIcon className="animate-spin" />}
              {dialog === "reject" ? "Tolak pembayaran" : "Terima"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Tombol ikon kecil + tooltip (teks hanya untuk pembaca layar).
function IconAction({
  label,
  variant,
  onClick,
  children,
}: {
  label: string;
  variant: React.ComponentProps<typeof Button>["variant"];
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button size="icon-sm" variant={variant} onClick={onClick} aria-label={label} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
