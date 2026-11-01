// Tombol "Hapus toko" di halaman detail toko (Superadmin), tepat di bawah
// Nonaktifkan/Aktifkan. Permanen dan menghapus SEMUA data toko, jadi
// Superadmin wajib mengetik ulang nama toko; tombol hapus baru aktif bila
// sama persis (server mengecek ulang). Berhasil → diarahkan ke daftar toko.

"use client";

import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
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
import { deleteStore } from "@/features/stores/actions";
import type { StoreDetail } from "@/features/stores/queries";
import { notify } from "@/lib/notify";

export function DeleteStoreButton({ store }: { store: StoreDetail }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = name.trim() === store.name.trim();

  function handleDelete() {
    if (!matches) return;
    startTransition(async () => {
      // Berhasil = server redirect ke /stores, baris di bawah tidak dijalankan.
      const result = await deleteStore(store.id, name);
      if (!result.success) notify.error(result.message);
    });
  }

  return (
    <ActionRow
      title="Hapus toko"
      description="Menghapus toko ini PERMANEN beserta semua datanya: pengguna, barang, stok, transaksi, bon, pengeluaran, dan tagihan. Tidak bisa dibatalkan."
    >
      <Button
        variant="destructive"
        onClick={() => {
          setName("");
          setOpen(true);
        }}
      >
        <Trash2Icon />
        Hapus toko
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {store.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua data toko ini dihapus permanen: akun pemilik & kasir, barang & stok, pembelian, penjualan, bon,
              pengeluaran, stok opname, tagihan langganan & bukti transfer. Data yang sudah dihapus tidak bisa
              dikembalikan. Bila hanya ingin menghentikan akses, pakai Nonaktifkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleDelete();
            }}
          >
            <Field>
              <FieldLabel htmlFor="delete-store-name">
                Ketik <span className="font-semibold select-all">{store.name}</span> untuk konfirmasi
              </FieldLabel>
              <Input
                id="delete-store-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                disabled={pending}
                aria-invalid={name.length > 0 && !matches}
              />
              <FieldDescription>Huruf besar/kecil harus sama persis.</FieldDescription>
            </Field>
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <Button variant="destructive" disabled={pending || !matches} onClick={handleDelete}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              Hapus permanen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ActionRow>
  );
}
