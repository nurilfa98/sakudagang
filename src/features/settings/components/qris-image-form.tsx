// Unggah/ganti/hapus gambar QRIS statis (Pengaturan platform), tampilan sama
// dengan ArchiPay: kotak pratinjau di kiri (gambar QRIS saat ini, atau kotak
// kosong "Belum ada gambar QRIS"), form di kanan. Gambar dilayani /api/qris
// setelah cek login; key gambar dipakai sebagai penanda versi agar browser
// memuat ulang gambar setelah diganti.

"use client";

import { ImageUpIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { startTransition, useActionState, useRef, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { removeQrisImage, uploadQrisImage } from "@/features/settings/actions";
import { notify } from "@/lib/notify";

export function QrisImageForm({ imageKey }: { imageKey: string | null }) {
  const [state, formAction, pending] = useActionState(uploadQrisImage, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useActionResult(state, (result) => {
    if (result.success) {
      notify.success("Gambar QRIS tersimpan.");
      formRef.current?.reset();
    } else notify.error(result.message);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  async function handleRemove() {
    const result = await removeQrisImage();
    if (!result.success) notify.error(result.message);
    else notify.success("Gambar QRIS dihapus.");
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {imageKey ? (
        // eslint-disable-next-line @next/next/no-img-element -- gambar privat lewat route /api/qris
        <img
          src={`/api/qris?v=${encodeURIComponent(imageKey)}`}
          alt="QRIS pembayaran SakuDagang"
          className="size-48 shrink-0 rounded-lg border bg-white object-contain p-2"
        />
      ) : (
        <div className="flex size-48 shrink-0 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Belum ada gambar QRIS
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} className="flex-1">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="qris">{imageKey ? "Ganti gambar QRIS" : "Unggah gambar QRIS"}</FieldLabel>
            {/* cursor-pointer: aturan UI SakuDagang untuk semua input unggah. */}
            <Input
              id="qris"
              name="qris"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
              className="cursor-pointer file:cursor-pointer"
            />
            <FieldDescription>QRIS statis dari bank / e-wallet bisnis. PNG, JPG, atau WebP, maks. 2 MB.</FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? <LoaderCircleIcon className="animate-spin" /> : <ImageUpIcon />}
              Simpan gambar
            </Button>
            {imageKey && (
              <ConfirmButton
                label="Hapus QRIS"
                variant="ghost"
                icon={<Trash2Icon />}
                dialogTitle="Hapus gambar QRIS?"
                dialogDescription="Halaman Langganan toko tidak lagi menampilkan QRIS sampai gambar baru diunggah."
                confirmLabel="Hapus"
                onConfirm={handleRemove}
              />
            )}
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
