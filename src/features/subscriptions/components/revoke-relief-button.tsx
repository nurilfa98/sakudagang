// Tombol Superadmin untuk membatalkan Perlindungan bulan sepi yang sudah
// diberikan (BUSINESS-FLOW §14.8): alasan wajib, hari tambahan dikurangkan
// dari masa aktif toko, pemilik dikabari lewat WhatsApp.

"use client";

import { LoaderCircleIcon, Undo2Icon } from "lucide-react";
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
import { revokeRelief } from "@/features/subscriptions/actions";
import type { ReliefItem } from "@/features/subscriptions/queries";
import { notify } from "@/lib/notify";

export function RevokeReliefButton({ relief }: { relief: ReliefItem }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeRelief(relief.id, reason);
      if (!result.success) notify.error(result.message);
      else {
        notify.success(`Perlindungan ${relief.periodLabel} dibatalkan; masa aktif dikurangi ${relief.days} hari.`);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="edit"
        onClick={() => {
          setReason("");
          setOpen(true);
        }}
      >
        <Undo2Icon />
        Batalkan
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan perlindungan {relief.periodLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Masa aktif toko dikurangi {relief.days} hari dan alasan Anda dikirim ke pemilik. Perlindungan yang
              dibatalkan tidak dihitung sebagai jatah terpakai.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor={`revoke-${relief.id}`}>Alasan pembatalan</FieldLabel>
            <Input
              id={`revoke-${relief.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Penjualan bulan ini tidak dicatat di kasir"
              maxLength={255}
              required
            />
            <FieldDescription>Tulis yang jelas; alasan ini tampil di riwayat dan WhatsApp pemilik.</FieldDescription>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <Button variant="edit" disabled={pending} onClick={handleRevoke}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              Batalkan perlindungan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
