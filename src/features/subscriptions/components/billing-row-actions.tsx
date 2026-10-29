// Aksi per baris tagihan PENDING di halaman Tagihan (Superadmin):
// "Tandai lunas" (dengan catatan opsional) dan "Batalkan".

"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
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
import { confirmSubscriptionPaid } from "@/features/subscriptions/actions";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import type { SubscriptionItem } from "@/features/subscriptions/queries";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { CancelInvoiceButton } from "./cancel-invoice-button";

export function BillingRowActions({ subscription }: { subscription: SubscriptionItem }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmSubscriptionPaid(subscription.id, note);
      if (!result.success) notify.error(result.message);
      else {
        notify.success(`Langganan ${subscription.storeName} diperpanjang.`);
        setOpen(false);
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" onClick={() => setOpen(true)}>
        <CheckIcon />
        Tandai lunas
      </Button>
      <CancelInvoiceButton subscriptionId={subscription.id} compact />

      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tandai lunas?</AlertDialogTitle>
            <AlertDialogDescription>
              {subscription.storeName}: paket {PLAN_LABELS[subscription.months]} sebesar {formatRupiah(subscription.price)}.
              Masa berlangganan toko langsung diperpanjang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor={`note-${subscription.id}`}>Catatan (opsional)</FieldLabel>
            <Input
              id={`note-${subscription.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Transfer BCA 28/10, ref 1234"
              maxLength={255}
            />
            <FieldDescription>Referensi transfer atau keterangan lain.</FieldDescription>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <Button disabled={pending} onClick={handleConfirm}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              Tandai lunas
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
