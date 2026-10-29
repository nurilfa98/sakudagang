// Form tambah pengguna.
//
// - Pemilik: toko & role sudah tetap (tokonya sendiri, Kasir) → hanya nama & email.
// - Superadmin: memilih toko dan role (Pemilik / Kasir).
//
// Setelah berhasil, form diganti panel berisi password sementara (hanya
// tampil sekali) dan tombol "Tambah pengguna lain" / "Lihat detail".
//
// Kenapa memakai onSubmit, bukan <form action={formAction}>?
// Dengan `action`, React mengosongkan form setelah Server Action selesai,
// termasuk saat validasi GAGAL. Dengan onSubmit + startTransition, isian
// tetap ada saat ada error.
//
// Referensi:
// - https://react.dev/reference/react-dom/components/form (bagian "Handle form submission")
// - https://react.dev/reference/react/useActionState

"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { PhoneInput } from "@/components/phone-input";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUser, type CreateUserResult } from "@/features/users/actions";
import type { StoreOption } from "@/features/stores/queries";
import type { AssignableRole } from "@/features/users/service";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { notify } from "@/lib/notify";
import { TemporaryPasswordAlert } from "./temporary-password-alert";

type Props = {
  // undefined = toko sudah tetap (Pemilik); array = Superadmin memilih.
  stores?: StoreOption[];
  defaultStoreId?: string;
  roleChoices: AssignableRole[];
  defaultRole: AssignableRole;
  backHref: string;
};

export function UserCreateForm(props: Props) {
  // Mengganti `key` membuat React membuat ulang form dari nol (isian & state
  // hasil action ikut kosong). Dipakai untuk "Tambah pengguna lain".
  const [formKey, setFormKey] = useState(0);
  return <CreateForm key={formKey} {...props} onReset={() => setFormKey((key) => key + 1)} />;
}

function CreateForm({ stores, defaultStoreId, roleChoices, defaultRole, backHref, onReset }: Props & { onReset: () => void }) {
  const [state, formAction, pending] = useActionState(createUser, undefined);
  const [storeId, setStoreId] = useState(defaultStoreId ?? "");
  const [role, setRole] = useState<string>(defaultRole);

  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  useEffect(() => {
    if (state && !state.success && !state.fieldErrors) notify.error(state.message);
  }, [state]);

  if (state?.success) {
    return <CreatedPanel result={state.data} backHref={backHref} onReset={onReset} />;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const storeItems = stores?.map((store) => ({ value: store.id, label: store.name })) ?? [];
  const roleItems = roleChoices.map((value) => ({ value, label: ROLE_LABELS[value] }));

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="role" value={role} />
      <FieldGroup>
        {stores && (
          <Field data-invalid={!!fieldError("storeId")}>
            <FieldLabel htmlFor="storeId">Toko</FieldLabel>
            <Select value={storeId} onValueChange={(value) => setStoreId(String(value ?? ""))} items={storeItems}>
              <SelectTrigger id="storeId" className="w-full" aria-invalid={!!fieldError("storeId")}>
                <SelectValue placeholder="Pilih toko" />
              </SelectTrigger>
              <SelectContent>
                {storeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{fieldError("storeId")}</FieldError>
          </Field>
        )}

        {roleChoices.length > 1 ? (
          <Field data-invalid={!!fieldError("role")}>
            <FieldLabel htmlFor="role">Role</FieldLabel>
            <Select value={role} onValueChange={(value) => setRole(String(value ?? ""))} items={roleItems}>
              <SelectTrigger id="role" className="w-full" aria-invalid={!!fieldError("role")}>
                <SelectValue placeholder="Pilih role" />
              </SelectTrigger>
              <SelectContent>
                {roleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!fieldError("role") && (
              <FieldDescription>Pemilik mengelola toko & kasir; Kasir hanya mencatat penjualan.</FieldDescription>
            )}
            <FieldError>{fieldError("role")}</FieldError>
          </Field>
        ) : (
          <FieldDescription>Akun dibuat dengan role {ROLE_LABELS[defaultRole]}.</FieldDescription>
        )}

        <TextField name="fullName" label="Nama lengkap" autoComplete="off" required error={fieldError("fullName")} />
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="off"
          description="Dipakai untuk login. Kredensial dikirim ke email ini, kecuali bagian sebelum @ sama dengan nama depan (email hanya syarat login, mis. nita@gmail.com untuk Nita Aulia)."
          required
          error={fieldError("email")}
        />
        <PhoneInput
          name="phone"
          label="Nomor WhatsApp"
          description="Opsional. Untuk mengirim undangan login langsung lewat WhatsApp."
          error={fieldError("phone")}
        />

        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : "Simpan"}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={backHref} />}>
            Batal
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

// Tombol "Lihat detail" dan "Selesai" me-reset form DULU, baru pindah halaman.
// Dengan cacheComponents, Next.js menyimpan halaman ini secara tersembunyi
// (React <Activity>) saat user pindah; tanpa reset, panel password ini masih
// tampil saat user kembali ke /users/new.
function CreatedPanel({ result, backHref, onReset }: { result: CreateUserResult; backHref: string; onReset: () => void }) {
  const router = useRouter();

  function leave(href: string) {
    onReset();
    router.push(href);
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <TemporaryPasswordAlert
        title="Pengguna berhasil dibuat"
        userId={result.id}
        fullName={result.fullName}
        email={result.email}
        phone={result.phone}
        password={result.temporaryPassword}
        emailSent={result.emailSent}
        kind="created"
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={onReset}>Tambah pengguna lain</Button>
        <Button variant="outline" onClick={() => leave(`/users/${result.id}`)}>
          Lihat detail
        </Button>
        <Button variant="ghost" onClick={() => leave(backHref)}>
          Selesai
        </Button>
      </div>
    </div>
  );
}
