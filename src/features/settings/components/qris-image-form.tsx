// Unggah/hapus gambar QRIS statis (Pengaturan). Gambar tampil dari
// /api/qris (dilayani server setelah cek login); key gambar dipakai sebagai
// penanda versi agar browser memuat ulang setelah diganti.

"use client";

import { LoaderCircleIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { removeQrisImage, uploadQrisImage } from "@/features/settings/actions";
import { notify } from "@/lib/notify";

export function QrisImageForm({ imageKey }: { imageKey: string | null }) {
  const hasImage = imageKey != null;
  const [state, formAction, pending] = useActionState(uploadQrisImage, undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success) {
      notify.success("Gambar QRIS disimpan.");
      if (fileRef.current) fileRef.current.value = "";
    } else if (state) notify.error(state.message);
  }, [state]);

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
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element -- gambar dilayani route /api/qris
        <img src={`/api/qris?v=${encodeURIComponent(imageKey ?? "")}`} alt="QRIS saat ini" className="w-40 shrink-0 rounded-md border bg-white" />
      )}
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-1 flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="qris">{hasImage ? "Ganti gambar QRIS" : "Gambar QRIS"}</FieldLabel>
          {/* cursor-pointer: aturan UI SakuDagang untuk semua input unggah. */}
          <Input
            ref={fileRef}
            id="qris"
            name="qris"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="cursor-pointer file:cursor-pointer"
          />
          <FieldDescription>PNG/JPG/WebP maksimal 2 MB. QRIS statis milik merchant SakuDagang; nominal diketik pembayar.</FieldDescription>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}
            {pending ? "Mengunggah..." : "Unggah"}
          </Button>
          {hasImage && (
            <ConfirmButton
              label="Hapus"
              variant="ghost"
              icon={<Trash2Icon />}
              dialogTitle="Hapus gambar QRIS?"
              dialogDescription="Halaman Langganan toko tidak lagi menampilkan QRIS sampai gambar baru diunggah."
              confirmLabel="Hapus"
              onConfirm={handleRemove}
            />
          )}
        </div>
      </form>
    </div>
  );
}
