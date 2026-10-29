// Kelola kategori barang: tambah, ubah nama, hapus (bila tidak dipakai).
// Satu Client Component kecil karena interaksinya sederhana dan datanya
// sedikit (belasan kategori per toko).

"use client";

import { CheckIcon, LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { startTransition, useActionState, useEffect, useState, useTransition, type FormEvent } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createCategory, deleteCategory, renameCategory } from "@/features/products/actions";
import type { CategoryItem } from "@/features/products/queries";
import { notify } from "@/lib/notify";

export function CategoryManager({ categories }: { categories: CategoryItem[] }) {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <AddCategoryForm />
      <ul className="divide-y rounded-lg border bg-card">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
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
function AddCategoryForm() {
  const [formKey, setFormKey] = useState(0);
  return <AddForm key={formKey} onCreated={() => setFormKey((key) => key + 1)} />;
}

function AddForm({ onCreated }: { onCreated: () => void }) {
  const [state, formAction, pending] = useActionState(createCategory, undefined);
  const error = state && !state.success ? state : undefined;

  useEffect(() => {
    if (state?.success) {
      notify.success("Kategori ditambahkan.");
      onCreated();
    } else if (state && !state.fieldErrors) notify.error(state.message);
  }, [state, onCreated]);

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

function CategoryRow({ category }: { category: CategoryItem }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string>();
  const [pending, startSaving] = useTransition();

  function save() {
    startSaving(async () => {
      const result = await renameCategory(category.id, name);
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
    const result = await deleteCategory(category.id);
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
            <p className="text-xs text-muted-foreground">{category.productCount} barang</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={`Ubah ${category.name}`}>
            <PencilIcon />
          </Button>
          {category.productCount === 0 && (
            <ConfirmButton
              label=""
              variant="ghost"
              dialogTitle={`Hapus kategori ${category.name}?`}
              dialogDescription="Kategori ini belum dipakai barang mana pun."
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
