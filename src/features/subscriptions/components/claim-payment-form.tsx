// Form "Saya sudah bayar" di kartu tagihan (Pemilik): bukti transfer wajib
// (foto/screenshot/PDF) + catatan opsional. Setelah dikirim, status tagihan
// menjadi "Menunggu konfirmasi"; akses toko TIDAK berubah sampai admin
// menandai lunas (BUSINESS-FLOW §14.2).

"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { startTransition, useActionState, useEffect, type FormEvent } from "react";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { claimSubscriptionPaid } from "@/features/subscriptions/actions";
import { notify } from "@/lib/notify";

export function ClaimPaymentForm({ subscriptionId }: { subscriptionId: string }) {
  const [state, formAction, pending] = useActionState(claimSubscriptionPaid, undefined);

  useEffect(() => {
    if (state?.success) notify.success("Terima kasih. Admin akan memeriksa dan mengonfirmasi pembayaran Anda.");
    else if (state) notify.error(state.message);
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="proof">Bukti transfer</FieldLabel>
          {/* autoFocus: form unggah selalu langsung fokus ke input file (aturan UI
              SakuDagang), agar pemilik tinggal memilih berkas. */}
          <Input
            id="proof"
            name="proof"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            required
            autoFocus
          />
          <FieldDescription>Foto/screenshot bukti transfer atau PDF, maksimal 3 MB. Wajib agar admin bisa mencocokkan.</FieldDescription>
        </Field>
        <TextField name="note" label="Catatan (opsional)" placeholder="Transfer dari BCA a.n. Rosa, 29 Okt 14.10" autoComplete="off" />
        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
            {pending ? "Mengirim..." : "Saya sudah bayar"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
