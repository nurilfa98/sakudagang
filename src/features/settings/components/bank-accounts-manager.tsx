// Daftar rekening bank tujuan transfer (Pengaturan, Superadmin): bisa lebih
// dari satu, nama bank bebas, boleh kosong (pemilik lalu hanya melihat QRIS).
// Rekening baru ditambahkan lewat form di bawah daftar; menghapus meminta
// konfirmasi. Mengubah = hapus lalu tambah lagi.

"use client";

import { LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { AccountNumberInput } from "@/components/account-number-input";
import { ConfirmButton } from "@/components/confirm-button";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { addBankAccount, deleteBankAccount } from "@/features/settings/actions";
import type { BankAccountItem } from "@/features/settings/queries";
import { bankAccentClass, formatAccountNumber } from "@/lib/bank";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

// Saran nama bank (datalist); nama lain tetap boleh diketik.
const BANK_SUGGESTIONS = ["BCA", "BRI", "Mandiri", "BNI", "BSI", "CIMB Niaga", "Bank Jago", "SeaBank"];

export function BankAccountsManager({ accounts }: { accounts: BankAccountItem[] }) {
  const [pending, startTransition] = useTransition();
  // Hasil action terakhir (untuk pesan error per field).
  const [error, setError] = useState<{ fieldErrors?: Record<string, string[]> } | null>(null);
  // Nama bank dikontrol agar pola strip nomor rekening mengikuti bank yang diketik.
  const [bankName, setBankName] = useState("");
  // Form dikosongkan setelah berhasil: ganti key agar semua input ter-reset.
  const [formKey, setFormKey] = useState(0);
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  // Action dipanggil langsung di dalam transition (bukan useActionState) agar
  // state form bisa di-reset setelah hasilnya diketahui, tanpa setState di effect.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await addBankAccount(undefined, formData);
      if (result.success) {
        notify.success("Rekening ditambahkan.");
        setError(null);
        setBankName("");
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
          Belum ada rekening. Pemilik toko hanya akan melihat QRIS (bila ada). Tambahkan rekening di bawah.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            // Garis tepi & nama bank memakai warna khas bank (lib/bank.ts).
            <li
              key={account.id}
              className={cn("flex items-start justify-between gap-2 rounded-lg border-2 p-3 text-sm", bankAccentClass(account.bankName))}
            >
              <div className="min-w-0">
                <p className="font-semibold">{account.bankName}</p>
                <p className="font-mono text-base text-foreground tabular-nums">{formatAccountNumber(account.bankName, account.accountNumber)}</p>
                <p className="truncate text-muted-foreground">a.n. {account.accountName}</p>
              </div>
              <ConfirmButton
                label=""
                icon={<Trash2Icon />}
                ariaLabel={`Hapus rekening ${account.bankName}`}
                tooltip="Hapus rekening"
                variant="destructive"
                size="icon-sm"
                dialogTitle={`Hapus rekening ${account.bankName}?`}
                dialogDescription="Rekening tidak lagi ditampilkan ke pemilik toko sebagai tujuan transfer."
                confirmLabel="Hapus"
                onConfirm={() => handleDelete(account.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <form key={formKey} onSubmit={handleSubmit} className="max-w-xl rounded-lg border bg-muted/30 p-4">
        <FieldGroup>
          <p className="text-sm font-medium">Tambah rekening</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="bankName"
              label="Nama bank"
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              placeholder="BCA"
              autoComplete="off"
              list="bank-suggestions"
              required
              error={fieldError("bankName")}
            />
            <datalist id="bank-suggestions">
              {BANK_SUGGESTIONS.map((bank) => (
                <option key={bank} value={bank} />
              ))}
            </datalist>
            <AccountNumberInput
              name="accountNumber"
              label="Nomor rekening"
              bankName={bankName}
              placeholder="123-456-7890"
              description="Strip menyesuaikan pola bank yang diketik."
              required
              error={fieldError("accountNumber")}
            />
          </div>
          <TextField
            name="accountName"
            label="Atas nama"
            placeholder="PT Realitech Solutions"
            autoComplete="off"
            required
            error={fieldError("accountName")}
          />
          <Field orientation="horizontal">
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
              {pending ? "Menyimpan..." : "Tambah rekening"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
