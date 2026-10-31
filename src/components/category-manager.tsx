// Kelola kategori (barang, pengeluaran): tambah, ubah nama, hapus (bila
// tidak dipakai). Satu Client Component kecil karena interaksinya sederhana
// dan datanya sedikit (belasan kategori per toko).
//
// Server Action-nya diberikan halaman lewat props, sehingga komponen ini
// dipakai lintas fitur (karena itu letaknya di components/). Setiap action
// tetap memeriksa permission & toko sendiri.

"use client";

import { CheckIcon, LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { startTransition, useActionState, useState, useTransition, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action-result";

export type ManagedCategory = { id: string; name: string; usageCount: number };

export type CategoryActions = {
  create: (prevState: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  rename: (categoryId: string, name: string) => Promise<ActionResult>;
  remove: (categoryId: string) => Promise<ActionResult>;
};

export function CategoryManager({
  categories,
  actions,
  usageLabel,
}: {
  categories: ManagedCategory[];
  actions: CategoryActions;
  usageLabel: string; // satuan pemakaian: "barang", "pengeluaran"
}) {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <AddCategoryForm create={actions.create} />
      <ul className="divide-y rounded-lg border bg-card">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} actions={actions} usageLabel={usageLabel} />
        ))}
        {categories.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">Belum ada kategori.</li>
        )}
      </ul>
    </div>
  );
}

// Mengganti `key` membuat React membuat ulang form dari nol (isian & state
// hasil action ikut kosong) setelah kategori berhasil ditambahkan.
function AddCategoryForm({ create }: { create: CategoryActions["create"] }) {
  const [formKey, setFormKey] = useState(0);
  return <AddForm key={formKey} create={create} onCreated={() => setFormKey((key) => key + 1)} />;
}

function AddForm({ create, onCreated }: { create: CategoryActions["create"]; onCreated: () => void }) {
  const [state, formAction, pending] = useActionState(create, undefined);
  const error = state && !state.success ? state : undefined;

  useActionResult(state, (result) => {
    if (result.success) {
      notify.success("Kategori ditambahkan.");
      onCreated();
    } else if (!result.fieldErrors) notify.error(result.message);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field data-invalid={!!error?.fieldErrors?.name}>
        <div className="flex gap-2">
          <Input name="name" placeholder="Nama kategori baru" aria-label="Nama kategori baru" autoComplete="off" required maxLength={50} />
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
            Tambah
          </Button>
        </div>
        <FieldError>{error?.fieldErrors?.name?.[0]}</FieldError>
      </Field>
    </form>
  );
}

function CategoryRow({
  category,
  actions,
  usageLabel,
}: {
  category: ManagedCategory;
  actions: CategoryActions;
  usageLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string>();
  const [pending, startSaving] = useTransition();

  function save() {
    startSaving(async () => {
      const result = await actions.rename(category.id, name);
      if (!result.success) {
        setError(result.fieldErrors?.name?.[0] ?? result.message);
        return;
      }
      setError(undefined);
      setEditing(false);
      notify.success("Nama kategori diubah.");
    });
  }

  function cancel() {
    setName(category.name);
    setError(undefined);
    setEditing(false);
  }

  async function remove() {
    const result = await actions.remove(category.id);
    if (!result.success) notify.error(result.message);
    else notify.success("Kategori dihapus.");
  }

  return (
    <li className="flex items-center gap-2 p-3">
      {editing ? (
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
                if (event.key === "Escape") cancel();
              }}
              aria-label="Nama kategori"
              maxLength={50}
              autoFocus
            />
            <Button size="icon" variant="outline" onClick={save} disabled={pending} aria-label="Simpan">
              {pending ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
            </Button>
            <Button size="icon" variant="ghost" onClick={cancel} disabled={pending} aria-label="Batal">
              <XIcon />
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      ) : (
        <>
          <div className="flex-1">
            <p className="font-medium">{category.name}</p>
            <p className="text-xs text-muted-foreground">
              {category.usageCount} {usageLabel}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={`Ubah ${category.name}`}>
            <PencilIcon />
          </Button>
          {category.usageCount === 0 && (
            <ConfirmButton
              label=""
              variant="ghost"
              dialogTitle={`Hapus kategori ${category.name}?`}
              dialogDescription={`Kategori ini belum dipakai ${usageLabel} mana pun.`}
              confirmLabel="Hapus"
              onConfirm={remove}
              icon={<Trash2Icon />}
              ariaLabel={`Hapus ${category.name}`}
            />
          )}
        </>
      )}
    </li>
  );
}
