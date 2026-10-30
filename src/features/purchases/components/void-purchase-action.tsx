// Tombol "Batalkan pembelian" + dialog alasan di halaman detail pembelian.
// Pembatalan mengurangi stok lagi dan menghitung ulang harga modal; ditolak
// server bila barangnya sudah terjual (stok akan minus).

"use client";

import { LoaderCircleIcon } from "lucide-react";
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
import { voidPurchase } from "@/features/purchases/actions";
import { notify } from "@/lib/notify";

export function VoidPurchaseAction({ purchaseId, number }: { purchaseId: string; number: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await voidPurchase(purchaseId, reason);
      if (!result.success) notify.error(result.message);
      else {
        notify.success(`${number} dibatalkan. Stok dan harga modal sudah dihitung ulang.`);
        setOpen(false);
      }
    });
  }

  return (
    <ActionRow
      title="Batalkan pembelian"
      description="Pembelian tidak bisa diedit. Bila salah input, batalkan lalu catat ulang."
    >
      <Button
        variant="destructive"
        onClick={() => {
          setReason("");
          setOpen(true);
        }}
      >
        Batalkan
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan {number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stok setiap barang dikurangi sebesar jumlah pembelian ini dan harga modal dihitung ulang tanpa
              pembelian ini. Harga jual yang sempat diubah tidak dikembalikan. Pembelian tetap tampil di riwayat
              dengan status Dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="void-reason">Alasan pembatalan</FieldLabel>
            <Input
              id="void-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Salah input harga beli gula"
              maxLength={500}
              required
            />
            <FieldDescription>Tersimpan sebagai jejak di detail pembelian.</FieldDescription>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Kembali</AlertDialogCancel>
            <Button variant="destructive" disabled={pending || !reason.trim()} onClick={handleConfirm}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              Batalkan pembelian
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ActionRow>
  );
}
