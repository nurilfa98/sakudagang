// Dialog "Pelanggan baru" (nama, WhatsApp, catatan). Dipakai dari layar kasir
// (CustomerPicker) dan halaman Bon (AddCustomerButton).
//
// Nama tidak unik (bisa ada dua "Bu Sri"); dialog hanya memperingatkan bila
// nama sama sudah ada, dan nomor HP membantu membedakan.

"use client";

import { LoaderCircleIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { PhoneInput } from "@/components/phone-input";
import { TextField } from "@/components/text-field";
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
import { FieldGroup } from "@/components/ui/field";
import { createCustomer } from "@/features/credits/actions";
import type { CustomerOption } from "@/features/credits/queries";
import { notify } from "@/lib/notify";

export function NewCustomerDialog({
  open,
  onOpenChange,
  existingNames,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: string[]; // huruf kecil, untuk peringatan nama sama
  onCreated: (customer: CustomerOption) => void;
}) {
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const duplicate = name.trim() !== "" && existingNames.includes(name.trim().toLowerCase());

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Form ini ada di dalam portal dialog; jangan sampai ikut men-submit form lain.
    event.stopPropagation();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createCustomer({
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        note: String(formData.get("note") ?? ""),
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) notify.error(result.message);
        return;
      }
      notify.success(`Pelanggan ${result.data.name} ditambahkan.`);
      onCreated(result.data);
      close();
    });
  }

  function close() {
    setName("");
    setErrors({});
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && (next ? onOpenChange(true) : close())}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Pelanggan baru</AlertDialogTitle>
            <AlertDialogDescription>Untuk mencatat bon. Nomor WhatsApp membantu menagih nanti.</AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <TextField
              name="name"
              label="Nama"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Bu Sri"
              autoComplete="off"
              maxLength={100}
              required
              description={duplicate ? "Nama ini sudah ada. Pastikan bukan orang yang sama, misalnya dengan nomor HP." : undefined}
              error={errors.name?.[0]}
            />
            <PhoneInput name="phone" label="Nomor WhatsApp (opsional)" error={errors.phone?.[0]} />
            <TextField
              name="note"
              label="Catatan (opsional)"
              placeholder="Rumah sebelah masjid"
              autoComplete="off"
              maxLength={500}
              error={errors.note?.[0]}
            />
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Batal
            </AlertDialogCancel>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              Simpan pelanggan
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Tombol "Tambah pelanggan" di halaman Bon: setelah dibuat langsung membuka
// halaman pelanggan itu.
export function AddCustomerButton({ existingNames }: { existingNames: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlusIcon />
        Tambah pelanggan
      </Button>
      <NewCustomerDialog
        open={open}
        onOpenChange={setOpen}
        existingNames={existingNames}
        onCreated={(customer) => router.push(`/credits/${customer.id}`)}
      />
    </>
  );
}
