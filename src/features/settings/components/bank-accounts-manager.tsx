// Rekening bank tujuan transfer langganan (Pengaturan platform, Superadmin),
// tampilan sama dengan ArchiPay: daftar rekening dengan garis warna khas bank,
// lalu form tambah tiga kolom (Nama bank, Nomor rekening, Atas nama). Boleh
// lebih dari satu atau kosong (Pemilik lalu hanya melihat QRIS). Menghapus
// meminta konfirmasi; mengubah = hapus lalu tambah lagi.

"use client";

import { LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { BankAccountFields } from "@/components/bank-account-fields";
import { ConfirmButton } from "@/components/confirm-button";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { addBankAccount, deleteBankAccount } from "@/features/settings/actions";
import type { BankAccountItem } from "@/features/settings/queries";
import { bankAccentClass, formatAccountNumber } from "@/lib/bank";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

export function BankAccountsManager({ accounts }: { accounts: BankAccountItem[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ fieldErrors?: Record<string, string[]> } | null>(null);
  // Form dikosongkan setelah berhasil: key baru membuat semua isian dibuat ulang.
  const [formKey, setFormKey] = useState(0);
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  // Action dipanggil langsung di dalam transition (bukan useActionState) agar
  // form bisa di-reset setelah hasilnya diketahui.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await addBankAccount(undefined, formData);
      if (result.success) {
        notify.success("Rekening ditambahkan.");
        setError(null);
        setFormKey((key) => key + 1);
      } else {
        setError(result);
        if (!result.fieldErrors) notify.error(result.message);
      }
    });
  }

  async function handleDelete(id: string) {
    const result = await deleteBankAccount(id);
    if (!result.success) notify.error(result.message);
    else notify.success("Rekening dihapus.");
  }

  return (
    <div className="flex flex-col gap-4">
      {accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Belum ada rekening. Pemilik hanya melihat QRIS (bila ada).
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              {/* Garis kiri & nama bank memakai warna khas bank (lib/bank.ts). */}
              <div className={cn("min-w-0 border-l-4 pl-3", bankAccentClass(account.bankName))}>
                <p className="font-semibold">{account.bankName}</p>
                <p className="font-mono text-base text-foreground tabular-nums">
                  {formatAccountNumber(account.bankName, account.accountNumber)}
                </p>
                <p className="truncate text-muted-foreground">a.n. {account.accountName}</p>
              </div>
              <ConfirmButton
                label=""
                icon={<Trash2Icon />}
                ariaLabel={`Hapus rekening ${account.bankName}`}
                tooltip="Hapus rekening"
                variant="ghost"
                size="icon"
                dialogTitle="Hapus rekening ini?"
                dialogDescription={`${account.bankName} ${formatAccountNumber(account.bankName, account.accountNumber)} a.n. ${account.accountName} tidak lagi tampil ke Pemilik.`}
                confirmLabel="Hapus"
                onConfirm={() => handleDelete(account.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div key={formKey} className="grid gap-4 sm:grid-cols-3">
            <BankAccountFields
              required
              bankNameError={fieldError("bankName")}
              accountError={fieldError("accountNumber")}
            />
            <TextField
              name="accountName"
              label="Atas nama"
              placeholder="PT Realitech Solutions"
              autoComplete="off"
              required
              error={fieldError("accountName")}
            />
          </div>
          <Field orientation="horizontal">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
              Tambah rekening
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
