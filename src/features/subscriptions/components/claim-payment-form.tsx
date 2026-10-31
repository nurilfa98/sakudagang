// Form "Saya sudah bayar" (Pemilik): bukti transfer wajib (foto/screenshot/
// PDF) + catatan opsional. Dua mode:
// - `months`         : tagihan baru dari paket yang dipilih (panel pembayaran).
// - `subscriptionId` : melengkapi tagihan kurang bayar (kartu tagihan).
// Tagihan/pembayaran tercatat saat form ini dikirim, berstatus "Menunggu
// konfirmasi"; akses toko TIDAK berubah sampai admin menerima pembayaran
// hingga lunas (BUSINESS-FLOW §14.2).
//
// Begitu berkas dipilih, pratinjaunya (kotak kecil, klik untuk memperbesar)
// tampil di bawah input agar pemilik yakin berkas yang benar sebelum mengirim.
// Pratinjau memakai URL objek lokal (belum diunggah ke server).

"use client";

import { CheckIcon, FileTextIcon, LoaderCircleIcon, ZoomInIcon } from "lucide-react";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { TextField } from "@/components/text-field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { claimSubscriptionPaid } from "@/features/subscriptions/actions";
import { notify } from "@/lib/notify";

type Selected = { url: string; name: string; isPdf: boolean };

export function ClaimPaymentForm({ months, subscriptionId }: { months?: number; subscriptionId?: string }) {
  const [state, formAction, pending] = useActionState(claimSubscriptionPaid, undefined);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [open, setOpen] = useState(false);

  useActionResult(state, (result) => {
    if (result.success) notify.success("Terima kasih. Admin akan memeriksa dan mengonfirmasi pembayaran Anda.");
    else notify.error(result.message);
  });

  // URL objek dilepas saat berkas diganti / komponen dilepas agar tidak bocor memori.
  useEffect(() => {
    if (!selected) return;
    const { url } = selected;
    return () => URL.revokeObjectURL(url);
  }, [selected]);

  function handleFileChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      setSelected(null);
      return;
    }
    setSelected({ url: URL.createObjectURL(file), name: file.name, isPdf: file.type === "application/pdf" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
      {months != null && <input type="hidden" name="months" value={months} />}
      {subscriptionId && <input type="hidden" name="subscriptionId" value={subscriptionId} />}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="proof">Bukti transfer</FieldLabel>
          {/* cursor-pointer: input berkas menampilkan kursor tangan (aturan UI
              SakuDagang untuk semua input unggah), agar jelas bisa diklik. */}
          <Input
            id="proof"
            name="proof"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            required
            className="cursor-pointer file:cursor-pointer"
            onChange={(event) => handleFileChange(event.target.files)}
          />
          <FieldDescription>Foto/screenshot bukti transfer atau PDF, maksimal 3 MB. Wajib agar admin bisa mencocokkan.</FieldDescription>
          {selected && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Perbesar pratinjau bukti"
                title="Perbesar pratinjau"
                className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white"
              >
                {selected.isPdf ? (
                  <FileTextIcon className="size-7 text-muted-foreground" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal (URL objek), belum diunggah
                  <img src={selected.url} alt="Pratinjau bukti transfer" className="size-full object-cover" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                  <ZoomInIcon className="size-5" />
                </span>
              </button>
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">{selected.name}</p>
                <p className="text-xs text-muted-foreground">Belum terkirim. Tekan &ldquo;Saya sudah bayar&rdquo; untuk mengirim.</p>
              </div>
            </div>
          )}
        </Field>
        <TextField name="note" label="Catatan (opsional)" placeholder="Transfer dari BCA a.n. Nita, 29 Okt 14.10" autoComplete="off" />
        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
            {pending ? "Mengirim..." : "Saya sudah bayar"}
          </Button>
        </Field>
      </FieldGroup>

      {selected && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent className="max-w-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Pratinjau bukti transfer</AlertDialogTitle>
            </AlertDialogHeader>
            {selected.isPdf ? (
              <iframe src={selected.url} title="Pratinjau bukti transfer (PDF)" className="h-[70vh] w-full rounded-md border bg-white" />
            ) : (
              <div className="flex max-h-[70vh] justify-center overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal (URL objek), belum diunggah */}
                <img src={selected.url} alt="Pratinjau bukti transfer" className="max-h-[70vh] w-auto rounded-md border bg-white object-contain" />
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Tutup</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  );
}
