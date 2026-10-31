// Dialog tambah / ubah pengeluaran: tanggal, kategori, nominal, keterangan.
// Tanpa `expense` = tambah (tombol "Catat pengeluaran"), dengan `expense` =
// ubah (tombol ikon pensil di baris tabel).
//
// Form dipasang ulang (key) setiap dialog dibuka agar isian & error lama hilang.

"use client";

import { LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { RupiahInput } from "@/components/rupiah-input";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { saveExpense } from "@/features/expenses/actions";
import type { ExpenseItem } from "@/features/expenses/queries";
import { notify } from "@/lib/notify";

type CategoryOption = { id: string; name: string };

export function ExpenseDialog({
  categories,
  today,
  expense,
}: {
  categories: CategoryOption[];
  today: string;
  expense?: ExpenseItem;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function openDialog() {
    setFormKey((key) => key + 1);
    setOpen(true);
  }

  return (
    <>
      {expense ? (
        <Tooltip>
          <TooltipTrigger
            render={<Button size="icon-sm" variant="ghost" onClick={openDialog} aria-label="Ubah pengeluaran" />}
          >
            <PencilIcon />
          </TooltipTrigger>
          <TooltipContent>Ubah pengeluaran</TooltipContent>
        </Tooltip>
      ) : (
        <Button onClick={openDialog}>
          <PlusIcon />
          Catat pengeluaran
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <ExpenseForm
            key={formKey}
            categories={categories}
            today={today}
            expense={expense}
            onDone={() => setOpen(false)}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ExpenseForm({
  categories,
  today,
  expense,
  onDone,
}: {
  categories: CategoryOption[];
  today: string;
  expense?: ExpenseItem;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveExpense, undefined);
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  useActionResult(state, (result) => {
    if (!result.success) {
      if (!result.fieldErrors) notify.error(result.message);
      return;
    }
    notify.success(expense ? "Pengeluaran diubah." : "Pengeluaran dicatat.");
    onDone();
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const items = categories.map((category) => ({ value: category.id, label: category.name }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {expense && <input type="hidden" name="expenseId" value={expense.id} />}
      <input type="hidden" name="categoryId" value={categoryId} />
      <AlertDialogHeader>
        <AlertDialogTitle>{expense ? "Ubah pengeluaran" : "Catat pengeluaran"}</AlertDialogTitle>
        <AlertDialogDescription>
          Biaya operasional (listrik, plastik, bensin, gaji). Belanja stok dicatat di Pembelian.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="date"
            label="Tanggal"
            type="date"
            defaultValue={expense?.date ?? today}
            max={today}
            required
            error={fieldError("date")}
          />
          <Field data-invalid={!!fieldError("amount")}>
            <FieldLabel htmlFor="amount">Nominal</FieldLabel>
            <RupiahInput
              id="amount"
              name="amount"
              defaultValue={expense?.amount}
              placeholder="50.000"
              required
              aria-invalid={!!fieldError("amount")}
            />
            <FieldError>{fieldError("amount")}</FieldError>
          </Field>
        </div>
        <Field data-invalid={!!fieldError("categoryId")}>
          <FieldLabel htmlFor="expense-category">Kategori</FieldLabel>
          <Select value={categoryId} onValueChange={(value) => setCategoryId(String(value ?? ""))} items={items}>
            <SelectTrigger id="expense-category" className="w-full" aria-invalid={!!fieldError("categoryId")}>
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{fieldError("categoryId")}</FieldError>
        </Field>
        <TextField
          name="note"
          label="Keterangan (opsional)"
          defaultValue={expense?.note ?? ""}
          placeholder="Token listrik bulan Oktober"
          autoComplete="off"
          maxLength={500}
          error={fieldError("note")}
        />
      </FieldGroup>
      <AlertDialogFooter>
        <AlertDialogCancel type="button" disabled={pending}>
          Batal
        </AlertDialogCancel>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircleIcon className="animate-spin" />}
          Simpan
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
