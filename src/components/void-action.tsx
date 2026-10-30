// Baris "Batalkan <dokumen>" + dialog alasan wajib, untuk dokumen yang tidak
// bisa diedit dan hanya bisa dibatalkan (pembelian, penjualan, nanti opname).
// Dialog tetap terbuka selama Server Action berjalan; gagal = toast error.
//
// `compact` = hanya tombol ikon + tooltip, untuk baris tabel (mis. pelunasan
// bon); tanpa itu tampil sebagai baris judul + keterangan + tombol.
//
// Dipakai lintas fitur, karena itu letaknya di components/.

"use client";

import { LoaderCircleIcon, Undo2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { ActionRow } from "@/components/confirm-button";
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
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action-result";

export function VoidAction({
  title,
  description,
  dialogTitle,
  dialogDescription,
  confirmLabel,
  reasonPlaceholder,
  successMessage,
  onVoid,
  compact = false,
}: {
  title: string;
  description: string;
  dialogTitle: string;
  dialogDescription: string;
  confirmLabel: string;
  reasonPlaceholder: string;
  successMessage: string;
  onVoid: (reason: string) => Promise<ActionResult>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await onVoid(reason);
      if (!result.success) notify.error(result.message);
      else {
        notify.success(successMessage);
        setOpen(false);
      }
    });
  }

  function openDialog() {
    setReason("");
    setOpen(true);
  }

  const dialog = (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="void-reason">Alasan pembatalan</FieldLabel>
          <Input
            id="void-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={reasonPlaceholder}
            maxLength={500}
            required
          />
          <FieldDescription>Tersimpan sebagai jejak di detail dokumen.</FieldDescription>
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Kembali</AlertDialogCancel>
          <Button variant="destructive" disabled={pending || !reason.trim()} onClick={handleConfirm}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (compact) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger render={<Button size="icon-sm" variant="ghost" onClick={openDialog} aria-label={title} />}>
            <Undo2Icon />
          </TooltipTrigger>
          <TooltipContent>{title}</TooltipContent>
        </Tooltip>
        {dialog}
      </>
    );
  }

  return (
    <ActionRow title={title} description={description}>
      <Button variant="destructive" onClick={openDialog}>
        Batalkan
      </Button>
      {dialog}
    </ActionRow>
  );
}
